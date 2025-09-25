/**
 * Browser-related types for XHS MCP Server
 */

import { Browser, Page } from 'puppeteer';
import { Config, Cookie } from '../shared/types';

export interface BrowserManagerConfig {
  config: Config;
  browser: Browser | null;
}

export interface BrowserLaunchOptions {
  headless?: boolean;
  executablePath?: string;
  slowMo?: number;
  args?: string[];
}

export interface PageOptions {
  loadCookies?: boolean;
  headless?: boolean;
  executablePath?: string;
  timeout?: number;
  navigationTimeout?: number;
}
