/**
 * Browser-related types for XHS MCP Server
 */

import { Browser, BrowserContext, Page } from 'puppeteer';
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

// Browser Pool Types
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
