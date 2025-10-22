/**
 * Browser Manager for XHS Operations
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { Config, Cookie } from '../../shared/types';
import { BrowserLaunchError, BrowserNavigationError, XHSError } from '../../shared/errors';
import { getConfig } from '../../shared/config';
import { loadCookies, saveCookies } from '../../shared/cookies';
import { logger } from '../../shared/logger';
import { sleep } from '../../shared/utils';
import { BrowserPoolService, ManagedBrowser } from './browser-pool.service';

export class BrowserManager {
  private config: Config;
  private browser: Browser | null = null;
  private browserPool: BrowserPoolService | null = null;
  private usePool: boolean = false;

  constructor(config?: Config, usePool: boolean = false) {
    this.config = config || getConfig();
    this.usePool = usePool;

    if (this.usePool) {
      this.browserPool = new BrowserPoolService(this.config);
    }
  }

  async createPage(
    headless?: boolean,
    executablePath?: string,
    loadCookiesFlag: boolean = true
  ): Promise<Page> {
    try {
      // Use browser pool if enabled
      if (this.usePool && this.browserPool) {
        return await this.createPageFromPool(loadCookiesFlag);
      }

      // Fallback to traditional browser management
      // Launch browser if not already launched
      if (!this.browser) {
        this.browser = await this.launchBrowser(headless, executablePath);
      }

      // Create new page
      const page = await this.browser.newPage();

      // Configure page timeouts
      page.setDefaultTimeout(this.config.browser.defaultTimeout);
      page.setDefaultNavigationTimeout(this.config.browser.navigationTimeout);

      // Load cookies if requested
      if (loadCookiesFlag) {
        await this.loadCookiesIntoPage(page);
      }

      return page;
    } catch (error) {
      logger.error(`Browser page creation error: ${error}`);
      throw this.handlePuppeteerError(error as Error, 'create_page');
    }
  }

  /**
   * Create a page using the browser pool
   */
  private async createPageFromPool(loadCookiesFlag: boolean = true): Promise<Page> {
    if (!this.browserPool) {
      throw new XHSError('Browser pool not initialized', 'BrowserPoolError');
    }

    const managedBrowser = await this.browserPool.acquireBrowser();

    try {
      // Create new page from the managed browser context
      const page = await managedBrowser.context.newPage();

      // Configure page timeouts
      page.setDefaultTimeout(this.config.browser.defaultTimeout);
      page.setDefaultNavigationTimeout(this.config.browser.navigationTimeout);

      // Load cookies if requested
      if (loadCookiesFlag) {
        await this.loadCookiesIntoPage(page);
      }

      // Store reference to managed browser for cleanup
      (page as Page & { _managedBrowser?: ManagedBrowser })._managedBrowser = managedBrowser;

      // Set up page close handler to release browser back to pool
      page.once('close', async () => {
        try {
          await this.browserPool!.releaseBrowser(managedBrowser);
        } catch (error) {
          logger.warn(`Error releasing browser back to pool: ${error}`);
        }
      });

      return page;
    } catch (error) {
      // Release browser back to pool on error
      try {
        await this.browserPool.releaseBrowser(managedBrowser);
      } catch (releaseError) {
        logger.warn(`Error releasing browser after page creation failure: ${releaseError}`);
      }
      throw error;
    }
  }

  private async launchBrowser(headless?: boolean, executablePath?: string): Promise<Browser> {
    const isHeadless = headless !== undefined ? headless : this.config.browser.headlessDefault;

    try {
      const launchOptions: any = {
        headless: isHeadless,
        slowMo: this.config.browser.slowmo,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      };

      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }

      const browser = await puppeteer.launch(launchOptions);

      return browser;
    } catch (error) {
      logger.error(`Failed to launch browser: ${error}`);
      throw new BrowserLaunchError(
        `Failed to launch browser: ${error}`,
        { headless: isHeadless, executablePath },
        error as Error
      );
    }
  }

  private async loadCookiesIntoPage(page: Page): Promise<boolean> {
    try {
      const cookies = loadCookies();

      if (!cookies) {
        return false;
      }

      // Convert our cookie format to Puppeteer format
      const puppeteerCookies = cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None' | undefined,
      }));

      await page.setCookie(...puppeteerCookies);
      return true;
    } catch (error) {
      logger.warn(`Failed to load cookies: ${error}`);
      return false;
    }
  }

  async saveCookiesFromPage(page: Page): Promise<void> {
    try {
      const cookies = await page.cookies();

      // Convert Puppeteer cookie format to our format
      const ourCookies: Cookie[] = cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None',
      }));

      saveCookies(ourCookies);
    } catch (error) {
      logger.error(`Failed to save cookies: ${error}`);
      throw this.handlePuppeteerError(error as Error, 'save_cookies');
    }
  }

  async navigateWithRetry(
    page: Page,
    url: string,
    waitUntil: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2' = 'load',
    maxRetries?: number
  ): Promise<void> {
    const retries = maxRetries || this.config.xhs.maxRetries;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await page.goto(url, {
          waitUntil,
          timeout: this.config.browser.navigationTimeout,
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
          if (attempt === retries) {
            throw new BrowserNavigationError(
              `Failed to navigate to ${url} after ${retries + 1} attempts`,
              { url, attempts: attempt + 1 },
              error
            );
          }

          await sleep(this.config.xhs.retryDelay * 1000);
        } else {
          throw error;
        }
      }
    }
  }

  async waitForSelectorSafe(
    page: Page,
    selector: string,
    timeout?: number,
    visible: boolean = true
  ): Promise<boolean> {
    try {
      await page.waitForSelector(selector, {
        timeout: timeout || this.config.browser.defaultTimeout,
        visible,
      });
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        return false;
      }
      throw error;
    }
  }

  async waitForElementVisible(page: Page, selector: string, timeout?: number): Promise<boolean> {
    return this.waitForSelectorSafe(page, selector, timeout, true);
  }

  async waitForElementHidden(page: Page, selector: string, timeout?: number): Promise<boolean> {
    return this.waitForSelectorSafe(page, selector, timeout, false);
  }

  async cleanup(): Promise<void> {
    // Cleanup browser pool if using it
    if (this.usePool && this.browserPool) {
      try {
        await this.browserPool.cleanup();
      } catch (error) {
        logger.warn(`Error cleaning up browser pool: ${error}`);
      } finally {
        this.browserPool = null;
      }
    }

    // Cleanup traditional browser instance
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        logger.warn(`Error closing browser: ${error}`);
      } finally {
        this.browser = null;
      }
    }
  }

  /**
   * Get browser pool statistics (if using pool)
   */
  getBrowserPoolStats() {
    if (this.usePool && this.browserPool) {
      return this.browserPool.getPoolStats();
    }
    return null;
  }

  /**
   * Enable browser pooling
   */
  enableBrowserPool(): void {
    if (!this.usePool) {
      this.usePool = true;
      this.browserPool = new BrowserPoolService(this.config);
    }
  }

  /**
   * Disable browser pooling
   */
  async disableBrowserPool(): Promise<void> {
    if (this.usePool && this.browserPool) {
      await this.browserPool.cleanup();
      this.browserPool = null;
      this.usePool = false;
    }
  }

  private handlePuppeteerError(error: Error, operation: string): XHSError {
    const context = { operation };

    if (error.name === 'TimeoutError') {
      if (operation.toLowerCase().includes('login')) {
        return new XHSError(
          `Login operation timed out during ${operation}`,
          'LoginTimeoutError',
          context,
          error
        );
      } else {
        return new XHSError(
          `Browser operation timed out: ${operation}`,
          'BrowserError',
          context,
          error
        );
      }
    } else {
      if (error.message.toLowerCase().includes('navigation')) {
        return new BrowserNavigationError(
          `Navigation failed during ${operation}: ${error.message}`,
          context,
          error
        );
      } else {
        return new XHSError(
          `Browser error during ${operation}: ${error.message}`,
          'BrowserError',
          context,
          error
        );
      }
    }
  }
}

// Global browser manager instance
let globalBrowserManager: BrowserManager | null = null;

export function getBrowserManager(usePool: boolean = false): BrowserManager {
  if (!globalBrowserManager) {
    globalBrowserManager = new BrowserManager(undefined, usePool);
  }
  return globalBrowserManager;
}

export function getBrowserManagerWithPool(): BrowserManager {
  return getBrowserManager(true);
}

export async function cleanupGlobalBrowserManager(): Promise<void> {
  if (globalBrowserManager) {
    await globalBrowserManager.cleanup();
    globalBrowserManager = null;
  }
}
