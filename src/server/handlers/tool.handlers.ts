/**
 * Tool request handlers for XHS MCP Server
 */

import { AuthService } from '../../core/auth/auth.service';
import { FeedService } from '../../core/feeds/feed.service';
import { PublishService } from '../../core/publishing/publish.service';
import { getConfig } from '../../shared/config';
import { XHSError } from '../../shared/errors';
import {
  validateRequiredParams,
  validatePublishNoteParams,
  safeErrorHandler,
  createToolResponse,
  createErrorResponse,
} from '../../shared/utils';
import { logger } from '../../shared/logger';

export class ToolHandlers {
  private authService: AuthService;
  private feedService: FeedService;
  private publishService: PublishService;

  constructor() {
    const config = getConfig();
    this.authService = new AuthService(config);
    this.feedService = new FeedService(config);
    this.publishService = new PublishService(config);
  }

  async handleAuthLogin(
    browserPath?: string
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    // Start login process in background and return immediately
    // This follows the "instant response" pattern described in README
    this.authService.login(browserPath).catch((error) => {
      safeErrorHandler(error, 'Background login error', logger);
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message:
                'Login process started. A browser window will open for you to complete the login.',
              status: 'login_started',
              action: 'browser_opened',
              instructions: [
                '1. Complete the login process in the opened browser window',
                '2. Scan QR code or enter your credentials',
                '3. Login will be automatically verified and cookies saved',
                '4. Use xhs_auth_status to check if login completed',
              ],
              note: 'The login process runs in the background. You can continue using other tools while login completes.',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleAuthLogout(): Promise<{ content: Array<{ type: string; text: string }> }> {
    const result = await this.authService.logout();
    return createToolResponse(result);
  }

  async handleAuthStatus(
    browserPath?: string
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const result = await this.authService.checkStatus(browserPath);
    return createToolResponse(result);
  }

  async handleDiscoverFeeds(
    browserPath?: string
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const result = await this.feedService.getFeedList(browserPath);
    return createToolResponse(result);
  }

  async handleSearchNote(
    keyword?: string,
    browserPath?: string
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    validateRequiredParams({ keyword }, ['keyword']);
    const result = await this.feedService.searchFeeds(keyword!, browserPath);
    return createToolResponse(result);
  }

  async handleGetNoteDetail(
    feedId?: string,
    xsecToken?: string,
    browserPath?: string
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    validateRequiredParams({ feedId, xsecToken }, ['feedId', 'xsecToken']);
    const result = await this.feedService.getFeedDetail(feedId!, xsecToken!, browserPath);
    return createToolResponse(result);
  }

  async handleCommentOnNote(
    feedId?: string,
    xsecToken?: string,
    note?: string,
    browserPath?: string
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    validateRequiredParams({ feedId, xsecToken, note }, ['feedId', 'xsecToken', 'note']);
    const result = await this.feedService.commentOnFeed(feedId!, xsecToken!, note!, browserPath);
    return createToolResponse(result);
  }

  async handlePublishContent(
    type?: string,
    title?: string,
    content?: string,
    mediaPaths?: string[],
    tags?: string,
    browserPath?: string
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    validateRequiredParams({ type, title, content, mediaPaths }, [
      'type',
      'title',
      'content',
      'mediaPaths',
    ]);

    // Validate content type
    if (type !== 'image' && type !== 'video') {
      throw new Error('Content type must be "image" or "video"');
    }

    // Validate parameter constraints
    if (title!.length > 20) {
      throw new Error('Title must be 20 characters or less');
    }
    if (content!.length > 1000) {
      throw new Error('Content must be 1000 characters or less');
    }

    // Execute unified publishing process
    const result = await this.publishService.publishContent(
      type as 'image' | 'video',
      title!,
      content!,
      mediaPaths!,
      tags,
      browserPath
    );
    return createToolResponse(result);
  }

  async handleToolRequest(
    name: string,
    args: any
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
      switch (name) {
        case 'xhs_auth_login':
          return await this.handleAuthLogin(args?.browser_path as string);

        case 'xhs_auth_logout':
          return await this.handleAuthLogout();

        case 'xhs_auth_status':
          return await this.handleAuthStatus(args?.browser_path as string);

        case 'xhs_discover_feeds':
          return await this.handleDiscoverFeeds(args?.browser_path as string);

        case 'xhs_search_note':
          return await this.handleSearchNote(args?.keyword as string, args?.browser_path as string);

        case 'xhs_get_note_detail':
          return await this.handleGetNoteDetail(
            args?.feed_id as string,
            args?.xsec_token as string,
            args?.browser_path as string
          );

        case 'xhs_comment_on_note':
          return await this.handleCommentOnNote(
            args?.feed_id as string,
            args?.xsec_token as string,
            args?.note as string,
            args?.browser_path as string
          );

        case 'xhs_publish_content':
          return await this.handlePublishContent(
            args?.type as string,
            args?.title as string,
            args?.content as string,
            args?.media_paths as string[],
            args?.tags as string,
            args?.browser_path as string
          );

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof XHSError) {
        return createToolResponse(error.toDict());
      }
      return createErrorResponse(error);
    }
  }
}
