/**
 * Type definitions for XHS MCP Server
 */

/**
 * Standard response format for all XHS operations
 */
export interface XHSResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
  readonly error?: string;
  readonly operation?: string;
  readonly context?: Record<string, unknown>;
}

/**
 * Browser automation configuration
 */
export interface BrowserConfig {
  readonly defaultTimeout: number;
  readonly loginTimeout: number;
  readonly pageLoadTimeout: number;
  readonly navigationTimeout: number;
  readonly slowmo: number;
  readonly headlessDefault: boolean;
}

/**
 * MCP server configuration
 */
export interface ServerConfig {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly defaultHost: string;
  readonly defaultPort: number;
  readonly defaultTransport: 'stdio' | 'sse' | 'streamable-http';
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  readonly level: string;
  readonly format: string;
  readonly fileEnabled: boolean;
  readonly filePath?: string;
}

/**
 * File paths configuration
 */
export interface PathsConfig {
  readonly appDataDir: string;
  readonly cookiesFile: string;
}

/**
 * XiaoHongShu platform configuration
 */
export interface XHSConfig {
  readonly homeUrl: string;
  readonly exploreUrl: string;
  readonly searchUrl: string;
  readonly creatorPublishUrl: string;
  readonly creatorVideoPublishUrl: string;
  readonly loginOkSelector: string;
  readonly requestDelay: number;
  readonly maxRetries: number;
  readonly retryDelay: number;
}

/**
 * Main application configuration
 */
export interface Config {
  readonly browser: BrowserConfig;
  readonly server: ServerConfig;
  readonly logging: LoggingConfig;
  readonly paths: PathsConfig;
  readonly xhs: XHSConfig;
}

/**
 * HTTP cookie structure
 */
export interface Cookie {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly expires?: number;
  readonly httpOnly?: boolean;
  readonly secure?: boolean;
  readonly sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Cookie file information
 */
export interface CookiesInfo {
  readonly filePath: string;
  readonly fileExists: boolean;
  readonly cookieCount: number;
  readonly lastModified?: number;
}

/**
 * Authentication login result
 */
export interface LoginResult {
  readonly success: boolean;
  readonly message: string;
  readonly status: 'logged_in' | 'logged_out';
  readonly action: 'none' | 'logged_in' | 'logged_out' | 'failed';
  readonly profile?: UserProfile;
}

/**
 * User profile information
 */
export interface UserProfile {
  readonly userId?: string;
  readonly nickname?: string;
  readonly username?: string;
  readonly avatar?: string;
  readonly followers?: number;
  readonly following?: number;
  readonly likes?: number;
  readonly xhsNumber?: string; // 小红书号
  readonly ipLocation?: string; // IP属地
  readonly profileUrl?: string; // 用户资料页面URL
}

/**
 * Authentication status result
 */
export interface StatusResult {
  readonly success: boolean;
  readonly loggedIn?: boolean;
  readonly status: 'logged_in' | 'logged_out' | 'unknown';
  readonly method?: string;
  readonly cookiesAvailable?: boolean;
  readonly cookieCount?: number;
  readonly cookiesFile?: string;
  readonly likelyLoggedIn?: boolean;
  readonly urlChecked?: string;
  readonly profile?: UserProfile;
  readonly error?: string;
}

/**
 * Individual feed item from XHS
 */
export interface FeedItem {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly desc: string;
  readonly images: readonly string[];
  readonly user: {
    readonly id: string;
    readonly nickname: string;
    readonly avatar: string;
  };
  readonly interact_info: {
    readonly liked: boolean;
    readonly liked_count: string;
    readonly collected: boolean;
    readonly collected_count: string;
    readonly comment_count: string;
    readonly share_count: string;
  };
  readonly time: number;
  readonly last_update_time: number;
}

/**
 * Feed list operation result
 */
export interface FeedListResult {
  readonly success: boolean;
  readonly feeds: readonly FeedItem[];
  readonly count: number;
  readonly source: string;
  readonly url: string;
}

/**
 * Search operation result
 */
export interface SearchResult {
  readonly success: boolean;
  readonly keyword: string;
  readonly feeds: readonly FeedItem[];
  readonly count: number;
  readonly searchUrl: string;
}

/**
 * Feed detail operation result
 */
export interface FeedDetailResult {
  readonly success: boolean;
  readonly feedId: string;
  readonly detail: Record<string, unknown>;
  readonly url: string;
}

/**
 * Comment operation result
 */
export interface CommentResult {
  readonly success: boolean;
  readonly message: string;
  readonly feedId: string;
  readonly note: string;
  readonly url: string;
}

/**
 * Publish operation result
 */
export interface PublishResult {
  readonly success: boolean;
  readonly message: string;
  readonly title: string;
  readonly content: string;
  readonly imageCount: number;
  readonly tags: string;
  readonly url: string;
  readonly noteId?: string;
}

/**
 * Server status information
 */
export interface ServerStatus {
  readonly server: {
    readonly status: string;
    readonly name: string;
    readonly version: string;
    readonly framework: string;
  };
  readonly authentication: StatusResult;
  readonly cookies: {
    readonly fileExists: boolean;
    readonly cookieCount: number;
  };
  readonly capabilities: {
    readonly toolsAvailable: number;
    readonly promptsAvailable: number;
    readonly resourcesAvailable: number;
  };
}

/**
 * Error context information
 */
export interface XHSErrorContext {
  readonly operation?: string;
  readonly url?: string;
  readonly feedId?: string;
  readonly keyword?: string;
  readonly timeout?: number;
  readonly attempts?: number;
  readonly [key: string]: unknown;
}

// Error classes moved to ./errors.ts
