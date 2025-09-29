/**
 * Configuration management for XHS MCP Server
 */

import { Config, BrowserConfig, ServerConfig, LoggingConfig, PathsConfig, XHSConfig } from './types';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;

  private constructor() {
    this.config = this.createDefaultConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public getConfig(): Config {
    return this.config;
  }

  public updateConfig(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
  }

  private createDefaultConfig(): Config {
    const appDataDir = join(homedir(), '.xhs-mcp');
    const cookiesFile = join(appDataDir, 'cookies.json');

    // Resolve package version from package.json (fallback to env or default)
    function resolvePackageVersion(): string {
      try {
        const hereFilePath = fileURLToPath(import.meta.url);
        const hereDir = dirname(hereFilePath);
        // From src/lib/shared/config.ts → dist/lib/shared/config.js at runtime
        // package.json resides at project root relative to compiled file: ../../../package.json
        const pkgPath = join(hereDir, '../../../package.json');
        const pkgRaw = readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgRaw) as { version?: string };
        if (pkg?.version && typeof pkg.version === 'string') return pkg.version;
      } catch {
        // ignore and fallback
      }
      return process.env.XHS_VERSION ?? '0.1.0';
    }

    const headlessEnv = process.env.XHS_HEADLESS;
    const browserConfig: BrowserConfig = {
      defaultTimeout: parseInt(process.env.XHS_BROWSER_TIMEOUT ?? '30000'),
      loginTimeout: parseInt(process.env.XHS_LOGIN_TIMEOUT ?? '300'),
      pageLoadTimeout: 30000,
      navigationTimeout: 30000,
      slowmo: 0,
      headlessDefault: headlessEnv == null ? true : headlessEnv.toLowerCase() === 'true',
    };

    const serverConfig: ServerConfig = {
      name: process.env.XHS_SERVER_NAME ?? 'xhs-mcp',
      version: resolvePackageVersion(),
      description: 'XiaoHongShu MCP Server - TypeScript Version',
      defaultHost: process.env.XHS_HOST ?? '127.0.0.1',
      defaultPort: parseInt(process.env.XHS_PORT ?? '8000'),
      defaultTransport: 'stdio',
    };

    const logFileEnv = process.env.XHS_LOG_FILE;
    const logFileEnabled = logFileEnv == null ? false : logFileEnv.toLowerCase() === 'true';
    const loggingConfig: LoggingConfig = {
      level: process.env.XHS_LOG_LEVEL ?? 'INFO',
      format: '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
      fileEnabled: logFileEnabled,
      filePath: logFileEnabled ? join(appDataDir, 'xhs-mcp.log') : undefined,
    };

    const pathsConfig: PathsConfig = {
      appDataDir,
      cookiesFile,
    };

    const xhsConfig: XHSConfig = {
      homeUrl: 'https://www.xiaohongshu.com',
      exploreUrl: 'https://www.xiaohongshu.com/explore',
      searchUrl: 'https://www.xiaohongshu.com/search_result',
      creatorPublishUrl: 'https://creator.xiaohongshu.com/publish/publish?source=official',
      creatorVideoPublishUrl: 'https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch&target=video',
      loginOkSelector: '.main-container .user .link-wrapper .channel',
      requestDelay: 1.0,
      maxRetries: 3,
      retryDelay: 2.0,
    };

    return {
      browser: browserConfig,
      server: serverConfig,
      logging: loggingConfig,
      paths: pathsConfig,
      xhs: xhsConfig,
    };
  }

  public toDict(): Record<string, any> {
    return {
      browser: {
        defaultTimeout: this.config.browser.defaultTimeout,
        loginTimeout: this.config.browser.loginTimeout,
        headlessDefault: this.config.browser.headlessDefault,
      },
      server: {
        name: this.config.server.name,
        version: this.config.server.version,
        defaultHost: this.config.server.defaultHost,
        defaultPort: this.config.server.defaultPort,
      },
      logging: {
        level: this.config.logging.level,
        fileEnabled: this.config.logging.fileEnabled,
      },
      paths: {
        appDataDir: this.config.paths.appDataDir,
        cookiesFile: this.config.paths.cookiesFile,
      },
      xhs: {
        homeUrl: this.config.xhs.homeUrl,
        exploreUrl: this.config.xhs.exploreUrl,
        maxRetries: this.config.xhs.maxRetries,
      },
    };
  }
}

// Global configuration instance
let globalConfig: Config | null = null;

export function getConfig(): Config {
  globalConfig ??= ConfigManager.getInstance().getConfig();
  return globalConfig;
}

export function setConfig(config: Config): void {
  globalConfig = config;
}
