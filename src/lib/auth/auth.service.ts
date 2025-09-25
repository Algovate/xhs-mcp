/**
 * Authentication service for XHS MCP Server
 */

import { Config, LoginResult, StatusResult } from '../shared/types.js';
import { LoginTimeoutError, LoginFailedError, NotLoggedInError, XHSError } from '../shared/errors.js';
import { BaseService } from '../shared/base.service.js';
import { deleteCookiesFile, getCookiesInfo } from '../shared/cookies.js';
import { isLoggedIn } from '../../utils/xhs.utils.js';
import { logger } from '../shared/logger.js';
import { sleep } from '../shared/utils.js';

export class AuthService extends BaseService {
  constructor(config: Config) {
    super(config);
  }

  async login(browserPath?: string, timeout: number = 300): Promise<LoginResult> {
    try {
      const page = await this.getBrowserManager().createPage(false, browserPath, true);

      try {
        // Navigate to explore page
        await this.getBrowserManager().navigateWithRetry(page, this.getConfig().xhs.exploreUrl);

        // Check if already logged in
        if (await isLoggedIn(page)) {
          return {
            success: true,
            message: 'Already logged in',
            status: 'logged_in',
            action: 'none',
          };
        }


        // Wait for login completion
        const checkInterval = 5; // Check every 5 seconds
        const maxChecks = timeout / checkInterval;


        for (let checkCount = 0; checkCount < maxChecks; checkCount++) {
          try {
            // Check if login completed with short timeout
            await page.waitForSelector(this.getConfig().xhs.loginOkSelector, {
              timeout: checkInterval * 1000,
            });
            // Login completed successfully
            break;
          } catch (error) {
            // Login not yet complete, continue checking
            const elapsed = (checkCount + 1) * checkInterval;
            const remaining = timeout - elapsed;

            if (checkCount === maxChecks - 1) {
              // Final timeout reached
              throw new LoginTimeoutError(
                `Login timed out after ${timeout} seconds. Please complete QR code scanning or manual login in the browser window.`,
                {
                  timeout,
                  url: this.getConfig().xhs.exploreUrl,
                  elapsedTime: elapsed,
                  suggestion: 'Increase timeout parameter or complete login faster',
                }
              );
            }
          }
        }

        // Save cookies after successful login
        await this.getBrowserManager().saveCookiesFromPage(page);

        // Verify login success
        await sleep(1000); // Brief wait for page to update
        if (await isLoggedIn(page)) {
          return {
            success: true,
            message: 'Login successful',
            status: 'logged_in',
            action: 'logged_in',
          };
        } else {
          throw new LoginFailedError('Login process completed but authentication verification failed');
        }
      } finally {
        await page.close();
      }
    } catch (error) {
      if (error instanceof LoginTimeoutError || error instanceof LoginFailedError) {
        throw error;
      }
      logger.error(`Login failed with unexpected error: ${error}`);
      throw new XHSError(`Login failed: ${error}`, 'LoginError', { timeout }, error as Error);
    }
  }

  async logout(): Promise<LoginResult> {
    try {
      const success = deleteCookiesFile();

      if (success) {
        return {
          success: true,
          message: 'Logged out successfully (cookies deleted)',
          status: 'logged_out',
          action: 'logged_out',
        };
      } else {
        return {
          success: false,
          message: 'Failed to delete cookies file',
          status: 'logged_out',
          action: 'none',
        };
      }
    } catch (error) {
      logger.error(`Logout failed: ${error}`);
      return {
        success: false,
        message: `Logout failed: ${error}`,
        status: 'logged_out',
        action: 'none',
      };
    }
  }


  async checkStatus(browserPath?: string): Promise<StatusResult> {
    try {
      const page = await this.getBrowserManager().createPage(true, browserPath, true);

      try {
        await this.getBrowserManager().navigateWithRetry(page, this.getConfig().xhs.exploreUrl);
        await sleep(1000); // Wait for page to load
        const loggedIn = await isLoggedIn(page);

        return {
          success: true,
          loggedIn,
          status: loggedIn ? 'logged_in' : 'logged_out',
          urlChecked: this.getConfig().xhs.exploreUrl,
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      logger.error(`Status check failed: ${error}`);
      throw new XHSError(`Status check failed: ${error}`, 'StatusCheckError', {}, error as Error);
    }
  }

}
