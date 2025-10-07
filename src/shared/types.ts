/**
 * Type definitions for XHS MCP Server
 */

export interface XHSResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  operation?: string;
  context?: Record<string, unknown>;
}

export interface BrowserConfig {
  defaultTimeout: number;
  loginTimeout: number;
  pageLoadTimeout: number;
  navigationTimeout: number;
  slowmo: number;
  headlessDefault: boolean;
}

export interface ServerConfig {
  name: string;
  version: string;
  description: string;
  defaultHost: string;
  defaultPort: number;
  defaultTransport: 'stdio' | 'sse' | 'streamable-http';
}

export interface LoggingConfig {
  level: string;
  format: string;
  fileEnabled: boolean;
  filePath?: string;
}

export interface PathsConfig {
  appDataDir: string;
  cookiesFile: string;
}

export interface XHSConfig {
  homeUrl: string;
  exploreUrl: string;
  searchUrl: string;
  creatorPublishUrl: string;
  creatorVideoPublishUrl: string;
  loginOkSelector: string;
  requestDelay: number;
  maxRetries: number;
  retryDelay: number;
}

export interface Config {
  browser: BrowserConfig;
  server: ServerConfig;
  logging: LoggingConfig;
  paths: PathsConfig;
  xhs: XHSConfig;
}

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface CookiesInfo {
  filePath: string;
  fileExists: boolean;
  cookieCount: number;
  lastModified?: number;
}

export interface LoginResult {
  success: boolean;
  message: string;
  status: 'logged_in' | 'logged_out';
  action: 'none' | 'logged_in' | 'logged_out' | 'failed';
}

export interface StatusResult {
  success: boolean;
  loggedIn?: boolean;
  status: 'logged_in' | 'logged_out' | 'unknown';
  method?: string;
  cookiesAvailable?: boolean;
  cookieCount?: number;
  cookiesFile?: string;
  likelyLoggedIn?: boolean;
  urlChecked?: string;
  error?: string;
}

export interface FeedItem {
  id: string;
  type: string;
  title: string;
  desc: string;
  images: string[];
  user: {
    id: string;
    nickname: string;
    avatar: string;
  };
  interact_info: {
    liked: boolean;
    liked_count: string;
    collected: boolean;
    collected_count: string;
    comment_count: string;
    share_count: string;
  };
  time: number;
  last_update_time: number;
}

export interface FeedListResult {
  success: boolean;
  feeds: FeedItem[];
  count: number;
  source: string;
  url: string;
}

export interface SearchResult {
  success: boolean;
  keyword: string;
  feeds: FeedItem[];
  count: number;
  searchUrl: string;
}

export interface FeedDetailResult {
  success: boolean;
  feedId: string;
  detail: Record<string, unknown>;
  url: string;
}

export interface CommentResult {
  success: boolean;
  message: string;
  feedId: string;
  note: string;
  url: string;
}

export interface PublishResult {
  success: boolean;
  message: string;
  title: string;
  content: string;
  imageCount: number;
  tags: string;
  url: string;
}

export interface ServerStatus {
  server: {
    status: string;
    name: string;
    version: string;
    framework: string;
  };
  authentication: StatusResult;
  cookies: {
    fileExists: boolean;
    cookieCount: number;
  };
  capabilities: {
    toolsAvailable: number;
    promptsAvailable: number;
    resourcesAvailable: number;
  };
}

export interface XHSErrorContext {
  operation?: string;
  url?: string;
  feedId?: string;
  keyword?: string;
  timeout?: number;
  attempts?: number;
  [key: string]: unknown;
}

// Error classes moved to ./errors.ts
