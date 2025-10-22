/**
 * Resource request handlers for XHS MCP Server
 */

import { AuthService } from '../../core/auth/auth.service';
import { getConfig, getCookiesInfo } from '../../shared/index';

export class ResourceHandlers {
  private authService: AuthService;

  constructor() {
    const config = getConfig();
    this.authService = new AuthService(config);
  }

  async getCookiesResource(): Promise<string> {
    try {
      const cookiesInfo = getCookiesInfo();
      return JSON.stringify(cookiesInfo, null, 2);
    } catch (error) {
      return JSON.stringify({ error: String(error) }, null, 2);
    }
  }

  async getConfigResource(): Promise<string> {
    try {
      const configDict = getConfig();
      const configWithFramework = {
        ...configDict,
        framework: 'MCP TypeScript',
        version: configDict.server.version,
      };
      return JSON.stringify(configWithFramework, null, 2);
    } catch (error) {
      return JSON.stringify({ error: String(error) }, null, 2);
    }
  }

  async getStatusResource(): Promise<string> {
    try {
      // Quick status check (but don't fail if it errors)
      let authStatus: any = { status: 'unknown', error: 'Status check not performed' };
      try {
        authStatus = await this.authService.checkStatus();
      } catch (error) {
        authStatus = { status: 'error', error: String(error) };
      }

      const cookiesInfo = getCookiesInfo();
      const config = getConfig();

      const statusData = {
        server: {
          status: 'running',
          name: config.server.name,
          version: config.server.version,
          framework: 'MCP TypeScript',
        },
        authentication: authStatus,
        cookies: {
          fileExists: cookiesInfo.fileExists,
          cookieCount: cookiesInfo.cookieCount,
        },
        capabilities: {
          toolsAvailable: 8,
          promptsAvailable: 0,
          resourcesAvailable: 3,
        },
      };

      return JSON.stringify(statusData, null, 2);
    } catch (error) {
      return JSON.stringify(
        {
          server: { status: 'error', error: String(error) },
          framework: 'MCP TypeScript',
        },
        null,
        2
      );
    }
  }

  async handleResourceRequest(uri: string) {
    try {
      let content: string;

      switch (uri) {
        case 'xhs://cookies':
          content = await this.getCookiesResource();
          break;

        case 'xhs://config':
          content = await this.getConfigResource();
          break;

        case 'xhs://status':
          content = await this.getStatusResource();
          break;

        default:
          throw new Error(`Unknown resource: ${uri}`);
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: content,
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ error: String(error) }, null, 2),
          },
        ],
      };
    }
  }
}
