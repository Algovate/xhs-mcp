/**
 * Utility functions for XHS operations
 */

import { Page } from 'puppeteer';
import { logger } from './logger';

export const XHS_HOME_URL = 'https://www.xiaohongshu.com';
export const XHS_EXPLORE_URL = `${XHS_HOME_URL}/explore`;
export const XHS_SEARCH_URL = `${XHS_HOME_URL}/search_result`;
export const XHS_CREATOR_PUBLISH_URL =
  'https://creator.xiaohongshu.com/publish/publish?source=official';
export const LOGIN_OK_SELECTOR = '.main-container .user .link-wrapper .channel';

export function makeSearchUrl(keyword: string): string {
  const params = new URLSearchParams({
    keyword,
    source: 'web_explore_feed',
  });
  return `${XHS_SEARCH_URL}?${params.toString()}`;
}

export function makeFeedDetailUrl(feedId: string, xsecToken: string): string {
  const params = new URLSearchParams({
    xsec_token: xsecToken,
    xsec_source: 'pc_feed',
  });
  return `${XHS_EXPLORE_URL}/${feedId}?${params.toString()}`;
}

export async function extractInitialState(page: Page): Promise<Record<string, unknown> | null> {
  try {
    // Wait for page to be fully loaded - Puppeteer doesn't have waitForLoadState
    // We'll just wait a bit for the page to settle
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 1000));
  } catch {
    // Ignore load state errors
  }

  try {
    const result = await page.evaluate(`
      (() => {
        // Try multiple possible state objects
        const possibleStates = [
          window.__INITIAL_STATE__,
          window.__INITIAL_SSR_STATE__,
          window.__NEXT_DATA__,
          window.__NUXT__,
          window.__VUE__,
          window.__REACT_QUERY_STATE__
        ];

        for (const state of possibleStates) {
          if (state && typeof state === 'object') {
            try {
              // Use a more robust JSON serialization that handles circular references
              const seen = new WeakSet();
              return JSON.stringify(state, (key, val) => {
                if (val != null && typeof val === "object") {
                  if (seen.has(val)) {
                    return "[Circular]";
                  }
                  seen.add(val);
                }
                return val;
              });
            } catch (e) {
              logger.warn('JSON.stringify failed for state:', e.message);
              continue;
            }
          }
        }

        // If no state found, try to find any global state
        const globalKeys = Object.keys(window).filter(key =>
          key.includes('STATE') || key.includes('DATA') || key.includes('INITIAL')
        );

        for (const key of globalKeys) {
          const value = window[key];
          if (value && typeof value === 'object') {
            try {
              const seen = new WeakSet();
              return JSON.stringify(value, (key, val) => {
                if (val != null && typeof val === "object") {
                  if (seen.has(val)) {
                    return "[Circular]";
                  }
                  seen.add(val);
                }
                return val;
              });
            } catch (e) {
              logger.warn('JSON.stringify failed for global key:', key, e.message);
              continue;
            }
          }
        }

        return '';
      })()
    `);

    if (!result) {
      return null;
    }

    return JSON.parse(result as string);
  } catch {
    return null;
  }
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    const elements = await page.$$(LOGIN_OK_SELECTOR);
    return elements.length > 0;
  } catch {
    return false;
  }
}

export async function getLoginStatusWithProfile(page: Page): Promise<{
  isLoggedIn: boolean;
  profile?: {
    userId?: string;
    nickname?: string;
    username?: string;
    avatar?: string;
    followers?: number;
    following?: number;
    likes?: number;
    xhsNumber?: string;
    ipLocation?: string;
    profileUrl?: string;
  };
}> {
  try {
    // First check if logged in using the existing method
    const elements = await page.$$(LOGIN_OK_SELECTOR);
    const isLoggedIn = elements.length > 0;

    if (!isLoggedIn) {
      return { isLoggedIn: false };
    }

    // If logged in, try to extract profile information from current page
    let profileData: Record<string, unknown> = {};
    try {
      profileData = await page.evaluate(() => {
        const profile: Record<string, unknown> = {};

        // Extract user ID from URL if on profile page
        // eslint-disable-next-line no-undef
        const urlMatch = window.location.href.match(/\/user\/profile\/([a-f0-9]+)/);
        if (urlMatch) {
          profile.userId = urlMatch[1];
        }

        // Try to find user nickname
        // eslint-disable-next-line no-undef
        const nameElement = document.querySelector(
          '.user-name, [class*="user-name"], [class*="nickname"]'
        );
        if (nameElement) {
          profile.nickname = nameElement.textContent?.trim();
        }

        // Try to find user info text that might contain stats
        // eslint-disable-next-line no-undef
        const infoElement = document.querySelector('.user-info, [class*="user-info"]');
        if (infoElement) {
          const infoText = infoElement.textContent || '';
          profile.infoText = infoText;

          // Try to extract numbers from the info text (followers, following, likes)
          const numbers = infoText.match(/\d+/g);
          if (numbers && numbers.length >= 3) {
            // Common pattern: followers, following, likes
            profile.following = parseInt(numbers[0]) || 0;
            profile.followers = parseInt(numbers[1]) || 0;
            profile.likes = parseInt(numbers[2]) || 0;
          }

          // Extract 小红书号 (XHS number)
          const xhsMatch = infoText.match(/小红书号：(\d+)/);
          if (xhsMatch) {
            profile.xhsNumber = xhsMatch[1];
          }

          // Extract IP属地 (IP location)
          const ipMatch = infoText.match(/IP属地：([^0-9]+)/);
          if (ipMatch) {
            profile.ipLocation = ipMatch[1].trim();
          }
        }

        // Try to find avatar
        // eslint-disable-next-line no-undef
        const avatarElement = document.querySelector(
          'img[class*="avatar"], img[class*="profile"], .avatar img, .profile img'
        ) as HTMLImageElement;
        if (avatarElement) {
          profile.avatar = avatarElement.src;
        }

        return profile;
      });
    } catch {
      logger.error('Error in page.evaluate');
      profileData = {};
    }

    return {
      isLoggedIn: true,
      profile: Object.keys(profileData).length > 0 ? profileData : undefined,
    };
  } catch {
    // If there's an error, fall back to basic login check
    try {
      const elements = await page.$$(LOGIN_OK_SELECTOR);
      return { isLoggedIn: elements.length > 0 };
    } catch {
      return { isLoggedIn: false };
    }
  }
}
