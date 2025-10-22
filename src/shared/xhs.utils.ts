/**
 * Utility functions for XHS operations
 */

import { Page } from 'puppeteer';

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
              console.log('JSON.stringify failed for state:', e.message);
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
              console.log('JSON.stringify failed for global key:', key, e.message);
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
