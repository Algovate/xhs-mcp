/**
 * Shared helpers for Creator Center page operations
 */

import { Page } from 'puppeteer';
import { NotLoggedInError, XHSError } from './errors';
import { sleep } from './utils';

export const CREATOR_CENTER_URL =
  'https://creator.xiaohongshu.com/new/note-manager?source=official';

export async function navigateToCreatorCenter(page: Page): Promise<void> {
  try {
    await page.goto(CREATOR_CENTER_URL, { waitUntil: 'load', timeout: 30000 });
    await sleep(3000);
  } catch (error) {
    throw new XHSError(
      'Failed to navigate to creator center',
      'CreatorCenterError',
      { url: CREATOR_CENTER_URL },
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

export async function verifyCreatorAuth(page: Page, loginOkSelector: string): Promise<void> {
  try {
    const loginElements = await page.$$(loginOkSelector);
    const creatorElements = await page.$$('[class*="user"], [class*="profile"], [class*="avatar"]');

    if (loginElements.length === 0 && creatorElements.length === 0) {
      const currentUrl = page.url();
      if (currentUrl.includes('login') || currentUrl.includes('signin')) {
        throw new NotLoggedInError('User not logged in', { url: currentUrl });
      }

      const noteElements = await page.$$('div.note');
      if (noteElements.length === 0) {
        throw new NotLoggedInError('User not logged in or no notes found', { url: currentUrl });
      }
    }
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      throw error;
    }
    throw new XHSError(
      'Failed to verify authentication',
      'CreatorCenterError',
      { operation: 'verifyAuth' },
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
