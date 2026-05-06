import { Config } from './types';
import { BrowserManager } from '../core/browser/browser.manager';

export abstract class BaseService {
  protected readonly config: Config;
  protected readonly browserManager: BrowserManager;

  constructor(config: Config, browserManager?: BrowserManager) {
    this.config = config;
    this.browserManager = browserManager ?? new BrowserManager(config);
  }

  protected getBrowserManager(): BrowserManager {
    return this.browserManager;
  }

  protected getConfig(): Config {
    return this.config;
  }
}
