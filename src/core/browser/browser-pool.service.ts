/**
 * Browser Pool Service for XHS Operations
 * Manages browser instance lifecycle with pooling, health monitoring, and automatic cleanup
 */

import puppeteer, { Browser, BrowserContext, Page } from 'puppeteer';
import { Config } from '../../shared/types';
import { BrowserLaunchError, XHSError } from '../../shared/errors';
import { getConfig } from '../../shared/config';
import { logger } from '../../shared/logger';
import { sleep } from '../../shared/utils';

export interface ManagedBrowser {
  browser: Browser;
  context: BrowserContext;
  id: string;
  createdAt: Date;
  lastUsed: Date;
  isAvailable: boolean;
  isHealthy: boolean;
  usageCount: number;
}

export interface BrowserPoolStats {
  totalInstances: number;
  availableInstances: number;
  busyInstances: number;
  unhealthyInstances: number;
  totalUsage: number;
  averageAge: number;
  oldestInstance: Date | null;
  newestInstance: Date | null;
}

export interface BrowserPoolOptions {
  minInstances?: number;
  maxInstances?: number;
  idleTimeout?: number;
  maxAge?: number;
  healthCheckInterval?: number;
  maxUsageCount?: number;
}

export class BrowserPoolService {
  private config: Config;
  private pool: Map<string, ManagedBrowser> = new Map();
  private options: Required<BrowserPoolOptions>;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config?: Config, options?: BrowserPoolOptions) {
    this.config = config || getConfig();

    // Set default options with configuration from environment or defaults
    this.options = {
      minInstances: options?.minInstances ?? 2,
      maxInstances: options?.maxInstances ?? 5,
      idleTimeout: options?.idleTimeout ?? 300000, // 5 minutes
      maxAge: options?.maxAge ?? 1800000, // 30 minutes
      healthCheckInterval: options?.healthCheckInterval ?? 60000, // 1 minute
      maxUsageCount: options?.maxUsageCount ?? 100,
    };

    this.startHealthMonitoring();
    this.startCleanupMonitoring();
  }

  /**
   * Acquire a browser instance from the pool
   */
  async acquireBrowser(options?: { timeout?: number }): Promise<ManagedBrowser> {
    if (this.isShuttingDown) {
      throw new XHSError('Browser pool is shutting down', 'BrowserPoolError');
    }

    const timeout = options?.timeout ?? 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Try to find an available healthy browser
      const availableBrowser = this.findAvailableBrowser();
      if (availableBrowser) {
        availableBrowser.isAvailable = false;
        availableBrowser.lastUsed = new Date();
        availableBrowser.usageCount++;

        logger.debug(`Acquired browser ${availableBrowser.id} from pool`);
        return availableBrowser;
      }

      // If no available browser and we can create more, create one
      if (this.pool.size < this.options.maxInstances) {
        try {
          const newBrowser = await this.createBrowserInstance();
          newBrowser.isAvailable = false;
          newBrowser.lastUsed = new Date();
          newBrowser.usageCount++;

          logger.info(`Created new browser ${newBrowser.id} for pool`);
          return newBrowser;
        } catch (error) {
          logger.error(`Failed to create new browser instance: ${error}`);
        }
      }

      // Wait a bit before retrying
      await sleep(100);
    }

    throw new XHSError(
      `Failed to acquire browser within ${timeout}ms timeout`,
      'BrowserPoolTimeout',
      { timeout, poolSize: this.pool.size, availableCount: this.getAvailableCount() }
    );
  }

  /**
   * Release a browser instance back to the pool
   */
  async releaseBrowser(browser: ManagedBrowser): Promise<void> {
    const managedBrowser = this.pool.get(browser.id);
    if (!managedBrowser) {
      logger.warn(`Attempted to release unknown browser ${browser.id}`);
      return;
    }

    // Check if browser should be retired due to age or usage
    const shouldRetire = this.shouldRetireBrowser(managedBrowser);
    if (shouldRetire) {
      logger.info(`Retiring browser ${browser.id} due to ${shouldRetire}`);
      await this.removeBrowserFromPool(browser.id);

      // Ensure we maintain minimum instances
      await this.ensureMinimumInstances();
      return;
    }

    // Perform health check before returning to pool
    const isHealthy = await this.checkBrowserHealth(managedBrowser);
    if (!isHealthy) {
      logger.warn(`Browser ${browser.id} failed health check, removing from pool`);
      await this.removeBrowserFromPool(browser.id);
      await this.ensureMinimumInstances();
      return;
    }

    // Return to pool
    managedBrowser.isAvailable = true;
    managedBrowser.isHealthy = true;

    logger.debug(`Released browser ${browser.id} back to pool`);
  }

  /**
   * Get current pool statistics
   */
  getPoolStats(): BrowserPoolStats {
    const instances = Array.from(this.pool.values());
    const availableInstances = instances.filter((b) => b.isAvailable && b.isHealthy).length;
    const busyInstances = instances.filter((b) => !b.isAvailable).length;
    const unhealthyInstances = instances.filter((b) => !b.isHealthy).length;
    const totalUsage = instances.reduce((sum, b) => sum + b.usageCount, 0);

    const ages = instances.map((b) => Date.now() - b.createdAt.getTime());
    const averageAge = ages.length > 0 ? ages.reduce((sum, age) => sum + age, 0) / ages.length : 0;

    const oldestInstance =
      instances.length > 0
        ? instances.reduce((oldest, current) =>
            current.createdAt < oldest.createdAt ? current : oldest
          ).createdAt
        : null;

    const newestInstance =
      instances.length > 0
        ? instances.reduce((newest, current) =>
            current.createdAt > newest.createdAt ? current : newest
          ).createdAt
        : null;

    return {
      totalInstances: instances.length,
      availableInstances,
      busyInstances,
      unhealthyInstances,
      totalUsage,
      averageAge,
      oldestInstance,
      newestInstance,
    };
  }

  /**
   * Cleanup and shutdown the browser pool
   */
  async cleanup(): Promise<void> {
    this.isShuttingDown = true;

    // Stop monitoring timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Close all browsers
    const closePromises = Array.from(this.pool.values()).map(async (managedBrowser) => {
      try {
        await managedBrowser.browser.close();
        logger.debug(`Closed browser ${managedBrowser.id}`);
      } catch (error) {
        logger.warn(`Error closing browser ${managedBrowser.id}: ${error}`);
      }
    });

    await Promise.allSettled(closePromises);
    this.pool.clear();

    logger.info('Browser pool cleanup completed');
  }

  /**
   * Create a new browser instance
   */
  private async createBrowserInstance(): Promise<ManagedBrowser> {
    try {
      const launchOptions: any = {
        headless: this.config.browser.headlessDefault,
        slowMo: this.config.browser.slowmo,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ],
      };

      const browser = await puppeteer.launch(launchOptions);
      const context = await browser.createBrowserContext();

      const id = this.generateBrowserId();
      const managedBrowser: ManagedBrowser = {
        browser,
        context,
        id,
        createdAt: new Date(),
        lastUsed: new Date(),
        isAvailable: true,
        isHealthy: true,
        usageCount: 0,
      };

      this.pool.set(id, managedBrowser);

      // Set up browser event handlers
      browser.on('disconnected', () => {
        logger.warn(`Browser ${id} disconnected unexpectedly`);
        this.handleBrowserDisconnection(id);
      });

      return managedBrowser;
    } catch (error) {
      logger.error(`Failed to create browser instance: ${error}`);
      throw new BrowserLaunchError(
        `Failed to create browser instance: ${error}`,
        { poolSize: this.pool.size },
        error as Error
      );
    }
  }

  /**
   * Find an available healthy browser in the pool
   */
  private findAvailableBrowser(): ManagedBrowser | null {
    for (const browser of this.pool.values()) {
      if (browser.isAvailable && browser.isHealthy) {
        return browser;
      }
    }
    return null;
  }

  /**
   * Check if a browser should be retired
   */
  private shouldRetireBrowser(browser: ManagedBrowser): string | null {
    const age = Date.now() - browser.createdAt.getTime();

    if (age > this.options.maxAge) {
      return 'max age exceeded';
    }

    if (browser.usageCount >= this.options.maxUsageCount) {
      return 'max usage count exceeded';
    }

    return null;
  }

  /**
   * Perform health check on a browser instance
   */
  private async checkBrowserHealth(browser: ManagedBrowser): Promise<boolean> {
    try {
      // Check if browser is connected
      if (!browser.browser.isConnected()) {
        return false;
      }

      // Try to create and close a test page
      const page = await browser.context.newPage();
      await page.close();

      return true;
    } catch (error) {
      logger.debug(`Browser ${browser.id} health check failed: ${error}`);
      return false;
    }
  }

  /**
   * Remove a browser from the pool
   */
  private async removeBrowserFromPool(browserId: string): Promise<void> {
    const browser = this.pool.get(browserId);
    if (!browser) {
      return;
    }

    try {
      await browser.browser.close();
    } catch (error) {
      logger.warn(`Error closing browser ${browserId}: ${error}`);
    }

    this.pool.delete(browserId);
    logger.debug(`Removed browser ${browserId} from pool`);
  }

  /**
   * Handle browser disconnection
   */
  private async handleBrowserDisconnection(browserId: string): Promise<void> {
    const browser = this.pool.get(browserId);
    if (browser) {
      browser.isHealthy = false;
      browser.isAvailable = false;
    }

    // Remove the disconnected browser and ensure minimum instances
    await this.removeBrowserFromPool(browserId);
    await this.ensureMinimumInstances();
  }

  /**
   * Ensure minimum number of instances are available
   */
  private async ensureMinimumInstances(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    const healthyCount = Array.from(this.pool.values()).filter((b) => b.isHealthy).length;

    const needed = this.options.minInstances - healthyCount;

    if (needed > 0) {
      logger.info(`Creating ${needed} browser instances to maintain minimum pool size`);

      const createPromises = Array.from({ length: needed }, () =>
        this.createBrowserInstance().catch((error) => {
          logger.error(`Failed to create browser for minimum instances: ${error}`);
          return null;
        })
      );

      await Promise.allSettled(createPromises);
    }
  }

  /**
   * Get count of available browsers
   */
  private getAvailableCount(): number {
    return Array.from(this.pool.values()).filter((b) => b.isAvailable && b.isHealthy).length;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }

      const unhealthyBrowsers: string[] = [];

      for (const [id, browser] of this.pool.entries()) {
        if (!browser.isAvailable) {
          continue; // Skip browsers currently in use
        }

        const isHealthy = await this.checkBrowserHealth(browser);
        if (!isHealthy) {
          unhealthyBrowsers.push(id);
          browser.isHealthy = false;
        }
      }

      // Remove unhealthy browsers
      for (const id of unhealthyBrowsers) {
        logger.warn(`Removing unhealthy browser ${id} during health check`);
        await this.removeBrowserFromPool(id);
      }

      // Ensure minimum instances after cleanup
      if (unhealthyBrowsers.length > 0) {
        await this.ensureMinimumInstances();
      }
    }, this.options.healthCheckInterval);
  }

  /**
   * Start cleanup monitoring for idle browsers
   */
  private startCleanupMonitoring(): void {
    this.cleanupTimer = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }

      const now = Date.now();
      const browsersToRemove: string[] = [];

      for (const [id, browser] of this.pool.entries()) {
        if (!browser.isAvailable) {
          continue; // Skip browsers currently in use
        }

        const idleTime = now - browser.lastUsed.getTime();
        const shouldRetire = this.shouldRetireBrowser(browser);

        if (idleTime > this.options.idleTimeout || shouldRetire) {
          // Only remove if we have more than minimum instances
          const healthyCount = Array.from(this.pool.values()).filter((b) => b.isHealthy).length;

          if (healthyCount > this.options.minInstances) {
            browsersToRemove.push(id);
          }
        }
      }

      // Remove idle/old browsers
      for (const id of browsersToRemove) {
        const reason = this.shouldRetireBrowser(this.pool.get(id)!) || 'idle timeout';
        logger.info(`Removing browser ${id} due to ${reason}`);
        await this.removeBrowserFromPool(id);
      }
    }, this.options.healthCheckInterval);
  }

  /**
   * Generate unique browser ID
   */
  private generateBrowserId(): string {
    return `browser_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Global browser pool instance
let globalBrowserPool: BrowserPoolService | null = null;

export function getBrowserPool(): BrowserPoolService {
  if (!globalBrowserPool) {
    globalBrowserPool = new BrowserPoolService();
  }
  return globalBrowserPool;
}

export async function cleanupBrowserPool(): Promise<void> {
  if (globalBrowserPool) {
    await globalBrowserPool.cleanup();
    globalBrowserPool = null;
  }
}
