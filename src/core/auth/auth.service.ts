/**
 * Authentication service for XHS MCP Server
 */

import { Config, LoginResult, StatusResult } from '../../shared/types';
import { LoginTimeoutError, LoginFailedError, NotLoggedInError, XHSError } from '../../shared/errors';
import { BaseService } from '../../shared/base.service';
import { deleteCookiesFile, getCookiesInfo } from '../../shared/cookies';
import { isLoggedIn, getLoginStatusWithProfile } from '../../shared/xhs.utils';
import { logger } from '../../shared/logger';
import { sleep } from '../../shared/utils';

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
          // Get profile information if already logged in
          let profile: any = undefined;
          try {
            // Find current user's profile link and extract user ID from URL
            const profileUrl = await page.evaluate(() => {
              const userLinks = Array.from(document.querySelectorAll('a[href*="/user/profile/"]'));
              const currentUserLink = userLinks.find(link => {
                const text = link.textContent?.trim();
                return text === '我' || (text && text.includes('profile')) || (text && text.includes('用户'));
              });
              return currentUserLink ? (currentUserLink as HTMLAnchorElement).href : null;
            });

            if (profileUrl) {
              // Extract user ID from profile URL
              const userIdMatch = profileUrl.match(/\/user\/profile\/([a-f0-9]+)/);
              if (userIdMatch) {
                profile = {
                  userId: userIdMatch[1],
                  profileUrl: profileUrl
                };
              }
            }

            // Also try to get additional profile info from current page
            const loginStatus = await getLoginStatusWithProfile(page);
            if (loginStatus.profile) {
              profile = { ...profile, ...loginStatus.profile };
            }
          } catch (profileError) {
            console.error('❌ Failed to get profile information:', profileError);
            // Continue without profile info
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

        // Verify login success and get profile information
        await sleep(1000); // Brief wait for page to update
        const loginStatus = await getLoginStatusWithProfile(page);
        if (loginStatus.isLoggedIn) {
          // Try to get additional profile information
          let profile = loginStatus.profile;
          try {
            // Find current user's profile link and extract user ID from URL
            const profileUrl = await page.evaluate(() => {
              const userLinks = Array.from(document.querySelectorAll('a[href*="/user/profile/"]'));
              const currentUserLink = userLinks.find(link => {
                const text = link.textContent?.trim();
                return text === '我' || (text && text.includes('profile')) || (text && text.includes('用户'));
              });
              return currentUserLink ? (currentUserLink as HTMLAnchorElement).href : null;
            });

            if (profileUrl) {
              // Extract user ID from profile URL
              const userIdMatch = profileUrl.match(/\/user\/profile\/([a-f0-9]+)/);
              if (userIdMatch) {
                profile = {
                  ...profile,
                  userId: userIdMatch[1],
                  profileUrl: profileUrl
                };
              }
            }
          } catch (profileError) {
            console.error('❌ Failed to get additional profile information:', profileError);
            // Continue with existing profile info
          }

          return {
            success: true,
            message: 'Login successful',
            status: 'logged_in',
            action: 'logged_in',
            profile,
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

        // First check if logged in
        const loggedIn = await isLoggedIn(page);

        if (!loggedIn) {
          return {
            success: true,
            loggedIn: false,
            status: 'logged_out',
            urlChecked: this.getConfig().xhs.exploreUrl,
          };
        }

        // If logged in, try to get profile information
        let profile: any = undefined;
        try {
          // Find current user's profile link and extract user ID from URL
          const profileUrl = await page.evaluate(() => {
            const userLinks = Array.from(document.querySelectorAll('a[href*="/user/profile/"]'));
            const currentUserLink = userLinks.find(link => {
              const text = link.textContent?.trim();
              return text === '我' || (text && text.includes('profile')) || (text && text.includes('用户'));
            });
            return currentUserLink ? (currentUserLink as HTMLAnchorElement).href : null;
          });

          if (profileUrl) {
            // Extract user ID from profile URL
            const userIdMatch = profileUrl.match(/\/user\/profile\/([a-f0-9]+)/);
            if (userIdMatch) {
              profile = {
                userId: userIdMatch[1],
                profileUrl: profileUrl
              };
            }
          }
        } catch (profileError) {
          console.error('❌ Failed to get profile information:', profileError);
          // Continue without profile info
        }

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
