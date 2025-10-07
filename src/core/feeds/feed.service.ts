/**
 * Feed operations service for XHS MCP Server
 */

import { Config, FeedListResult, SearchResult, FeedDetailResult, CommentResult, FeedItem } from '../../shared/types';
import { FeedError, FeedParsingError, FeedNotFoundError, NotLoggedInError, XHSError } from '../../shared/errors';
import { BaseService } from '../../shared/base.service';
import { makeSearchUrl, makeFeedDetailUrl, extractInitialState, isLoggedIn } from '../../shared/xhs.utils';
import { logger } from '../../shared/logger';
import { sleep } from '../../shared/utils';

export class FeedService extends BaseService {
  constructor(config: Config) {
    super(config);
  }

  async getFeedList(browserPath?: string): Promise<FeedListResult> {
    try {
      const page = await this.getBrowserManager().createPage(true, browserPath, true);

      try {
        await this.getBrowserManager().navigateWithRetry(page, this.getConfig().xhs.homeUrl);
        await sleep(1000);

        // Check if logged in
        if (!(await isLoggedIn(page))) {
          throw new NotLoggedInError('Must be logged in to access feed list', {
            operation: 'get_feed_list',
          });
        }

        // Extract initial state
        const state = await extractInitialState(page);

        if (!state) {
          throw new FeedParsingError('Could not extract any initial state from page. The page may not be fully loaded or the state structure has changed.', {
            url: this.getConfig().xhs.homeUrl,
            suggestion: 'Try logging in first using xhs_auth_login tool',
          });
        }

        const feedData = state.feed as Record<string, unknown>;
        if (!feedData) {
          throw new FeedParsingError('Could not find feed data in page state. You may need to log in first.', {
            url: this.getConfig().xhs.homeUrl,
            availableKeys: Object.keys(state),
            suggestion: 'Try logging in first using xhs_auth_login tool',
          });
        }

        const feedsData = feedData.feeds as Record<string, unknown>;
        if (!feedsData) {
          throw new FeedParsingError('Could not find feeds array in feed state.', {
            url: this.getConfig().xhs.homeUrl,
            feedKeys: Object.keys(feedData),
            suggestion: 'Try logging in first using xhs_auth_login tool',
          });
        }

        const feedsValue = (feedsData._value as unknown[]) || [];

        return {
          success: true,
          feeds: feedsValue as FeedItem[],
          count: feedsValue.length,
          source: 'home_page',
          url: this.getConfig().xhs.homeUrl,
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      if (error instanceof NotLoggedInError || error instanceof FeedParsingError) {
        throw error;
      }
      logger.error(`Failed to get feed list: ${error}`);
      throw new XHSError(`Failed to get feed list: ${error}`, 'GetFeedListError', {}, error as Error);
    }
  }

  async searchFeeds(keyword: string, browserPath?: string): Promise<SearchResult> {
    if (!keyword || !keyword.trim()) {
      throw new FeedError('Search keyword cannot be empty');
    }

    const trimmedKeyword = keyword.trim();

    try {
      const page = await this.getBrowserManager().createPage(true, browserPath, true);

      try {
        const searchUrl = makeSearchUrl(trimmedKeyword);
        await this.getBrowserManager().navigateWithRetry(page, searchUrl);
        await sleep(1000);

        // Extract search results
        const state = await extractInitialState(page);

        const searchData = state?.search as Record<string, unknown>;
        if (!state || !searchData || !searchData.feeds) {
          throw new FeedParsingError(`Could not extract search results for keyword: ${trimmedKeyword}`, {
            keyword: trimmedKeyword,
            url: searchUrl,
          });
        }

        const feedsValue = ((searchData.feeds as Record<string, unknown>)._value as unknown[]) || [];

        return {
          success: true,
          keyword: trimmedKeyword,
          feeds: feedsValue as FeedItem[],
          count: feedsValue.length,
          searchUrl,
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      if (error instanceof FeedError) {
        throw error;
      }
      logger.error(`Feed search failed for keyword '${trimmedKeyword}': ${error}`);
      throw new XHSError(`Feed search failed: ${error}`, 'SearchFeedsError', { keyword: trimmedKeyword }, error as Error);
    }
  }

  async getFeedDetail(feedId: string, xsecToken: string, browserPath?: string): Promise<FeedDetailResult> {
    if (!feedId || !xsecToken) {
      throw new FeedError('Both feed_id and xsec_token are required');
    }

    try {
      const page = await this.getBrowserManager().createPage(true, browserPath, true);

      try {
        const detailUrl = makeFeedDetailUrl(feedId, xsecToken);
        await this.getBrowserManager().navigateWithRetry(page, detailUrl);
        await sleep(1000);

        const state = await extractInitialState(page);

        const noteData = state?.note as Record<string, unknown>;
        if (!state || !noteData || !noteData.noteDetailMap) {
          throw new FeedParsingError(`Could not extract note details for feed: ${feedId}`, {
            feedId,
            url: detailUrl,
          });
        }

        const noteDetailMap = noteData.noteDetailMap as Record<string, unknown>;
        if (!(feedId in noteDetailMap)) {
          throw new FeedNotFoundError(`Feed ${feedId} not found in note details`, {
            feedId,
            availableFeeds: Object.keys(noteDetailMap),
          });
        }

        const detail = noteDetailMap[feedId] as Record<string, unknown>;

        return {
          success: true,
          feedId,
          detail,
          url: detailUrl,
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      if (error instanceof FeedError || error instanceof FeedNotFoundError || error instanceof FeedParsingError) {
        throw error;
      }
      logger.error(`Failed to get feed detail for ${feedId}: ${error}`);
      throw new XHSError(`Failed to get feed detail: ${error}`, 'GetFeedDetailError', { feedId }, error as Error);
    }
  }

  async commentOnFeed(feedId: string, xsecToken: string, note: string, browserPath?: string): Promise<CommentResult> {
    if (!feedId || !xsecToken || !note) {
      throw new FeedError('feed_id, xsec_token, and note are all required');
    }

    if (note.trim().length === 0) {
      throw new FeedError('Comment note cannot be empty');
    }

    try {
      const page = await this.getBrowserManager().createPage(false, browserPath, true);

      try {
        const detailUrl = makeFeedDetailUrl(feedId, xsecToken);
        await this.getBrowserManager().navigateWithRetry(page, detailUrl);
        await sleep(1000);

        // Check if logged in
        if (!(await isLoggedIn(page))) {
          throw new NotLoggedInError('Must be logged in to comment on feeds', {
            operation: 'comment_on_feed',
            feedId,
          });
        }

        // Click on comment input
        const commentInputSelector = 'div.input-box div.content-edit span';
        if (!(await this.getBrowserManager().waitForSelectorSafe(page, commentInputSelector))) {
          throw new FeedError('Comment input not found on page', {
            feedId,
            selector: commentInputSelector,
          });
        }

        const commentInput = await page.$(commentInputSelector);
        if (commentInput) {
          await commentInput.click();
        }

        // Fill comment note
        const editorSelector = 'div.input-box div.content-edit p.content-input';
        const editor = await page.$(editorSelector);

        if (editor) {
          await editor.click();
          await editor.type(note, { delay: 30 });
        }
        await sleep(1000);

        // Submit comment
        const submitSelector = 'div.bottom button.submit';
        const submitButton = await page.$(submitSelector);
        if (submitButton) {
          await submitButton.click();
        }
        await sleep(2000); // Wait for submission

        return {
          success: true,
          message: 'Comment submitted successfully',
          feedId,
          note,
          url: detailUrl,
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      if (error instanceof FeedError || error instanceof NotLoggedInError) {
        throw error;
      }
      logger.error(`Failed to comment on feed ${feedId}: ${error}`);
      throw new XHSError(`Failed to comment on feed: ${error}`, 'CommentOnFeedError', { feedId }, error as Error);
    }
  }

}
