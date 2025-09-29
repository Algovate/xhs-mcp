/**
 * Base service class for XHS MCP Server services
 */

import { Config } from './types';
import { BrowserManager } from '../core/browser/browser.manager';

/**
 * Base service class that provides common functionality for all services
 */
export abstract class BaseService {
  protected readonly config: Config;
  protected readonly browserManager: BrowserManager;

  constructor(config: Config) {
    this.config = config;
    this.browserManager = new BrowserManager(config);
  }

  /**
   * Get the browser manager instance
   */
  protected getBrowserManager(): BrowserManager {
    return this.browserManager;
  }

  /**
   * Get the configuration
   */
  protected getConfig(): Config {
    return this.config;
  }
}
