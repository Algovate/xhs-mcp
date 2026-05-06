/**
 * Authentication service for XHS MCP Server
 */

import { Config, LoginResult, StatusResult } from '../../shared/types';
import {
  LoginTimeoutError,
  LoginFailedError,
  XHSError,
} from '../../shared/errors';
import { BaseService } from '../../shared/base.service';
import { BrowserManager } from '../browser/browser.manager';
import { deleteCookiesFile } from '../../shared/cookies';
import { isLoggedIn, getLoginStatusWithProfile } from '../../shared/xhs.utils';
import { logger } from '../../shared/logger';
import { sleep } from '../../shared/utils';
import { Page } from 'puppeteer';

export class AuthService extends BaseService {
  constructor(config: Config, browserManager?: BrowserManager) {
    super(config, browserManager);
  }

  /**
   * Extract profile URL and user ID from the current page
   */
  private async extractProfileFromPage(page: Page): Promise<Record<string, string> | undefined> {
    try {
      const profileUrl = await page.evaluate(() => {
        const userLinks = Array.from(document.querySelectorAll('a[href*="/user/profile/"]'));
        const currentUserLink = userLinks.find((link) => {
          const text = link.textContent?.trim();
          return (
            text === '我' ||
            (text && text.includes('profile')) ||
            (text && text.includes('用户'))
          );
        });
        return currentUserLink ? (currentUserLink as HTMLAnchorElement).href : null;
      });

      if (profileUrl) {
        const userIdMatch = profileUrl.match(/\/user\/profile\/([a-f0-9]+)/);
        if (userIdMatch) {
          return { userId: userIdMatch[1], profileUrl };
        }
      }
    } catch (profileError) {
      logger.warn('Failed to get profile information:', profileError);
    }
    return undefined;
  }

  async login(browserPath?: string, timeout: number = 300): Promise<LoginResult> {
    try {
      const page = await this.getBrowserManager().createPage(false, browserPath, true);

      try {
        // Navigate to explore page
        await this.getBrowserManager().navigateWithRetry(page, this.getConfig().xhs.exploreUrl);

        // Check if already logged in
        if (await isLoggedIn(page)) {
          let profile: any = undefined;
          try {
            const extracted = await this.extractProfileFromPage(page);
            const loginStatus = await getLoginStatusWithProfile(page);
            profile = { ...extracted, ...loginStatus.profile };
          } catch (profileError) {
            logger.warn('Failed to get profile information:', profileError);
          }

          return {
            success: true,
            message: 'Already logged in',
            status: 'logged_in',
            action: 'none',
            profile,
          };
        }

        // Wait for login completion
        const checkInterval = 5;
        const maxChecks = timeout / checkInterval;

        for (let checkCount = 0; checkCount < maxChecks; checkCount++) {
          try {
            await page.waitForSelector(this.getConfig().xhs.loginOkSelector, {
              timeout: checkInterval * 1000,
            });
            break;
          } catch (error) {
            const elapsed = (checkCount + 1) * checkInterval;

            if (checkCount === maxChecks - 1) {
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

        // Verify login success and get profile information
        await sleep(1000);
        const loginStatus = await getLoginStatusWithProfile(page);
        if (loginStatus.isLoggedIn) {
          let profile = loginStatus.profile;
          try {
            const extracted = await this.extractProfileFromPage(page);
            if (extracted) {
              profile = { ...profile, ...extracted };
            }
          } catch (profileError) {
            logger.warn('Failed to get additional profile information:', profileError);
          }

          return {
            success: true,
            message: 'Login successful',
            status: 'logged_in',
            action: 'logged_in',
            profile,
          };
        } else {
          throw new LoginFailedError(
            'Login process completed but authentication verification failed'
          );
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
        await sleep(1000);

        const loggedIn = await isLoggedIn(page);

        if (!loggedIn) {
          return {
            success: true,
            loggedIn: false,
            status: 'logged_out',
            urlChecked: this.getConfig().xhs.exploreUrl,
          };
        }

        const profile = await this.extractProfileFromPage(page);

        return {
          success: true,
          loggedIn: true,
          status: 'logged_in',
          urlChecked: this.getConfig().xhs.exploreUrl,
          profile,
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
