import { Page } from 'puppeteer';
import { assertTitleWidthValid, getTitleWidth } from '../../shared/title-validator';
import { SELECTORS, TEXT_PATTERNS, VIDEO_TIMEOUTS } from './publish-base.service';
import { join } from 'path';
import { PublishResult } from '../../shared/types';
import { PublishError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { sleep } from '../../shared/utils';
import { existsSync, statSync } from 'fs';
import { PublishBaseService } from './publish-base.service';

export class VideoPublishService extends PublishBaseService {
  private async waitForVideoPublishCompletion(page: Page): Promise<string | null> {
    logger.debug('Waiting for video publish completion...');

    let isProcessing = false;

    await this.waitForCondition(
      async () => {
        // Check for success indicators
        const successResult = await this.checkElementForPatterns(
          page,
          SELECTORS.SUCCESS_INDICATORS,
          TEXT_PATTERNS.SUCCESS
        );

        if (successResult.found) {
          logger.debug(`Found success indicator: ${successResult.text}`);
          await sleep(VIDEO_TIMEOUTS.COMPLETION_CHECK);
          return true;
        }

        // Check for error indicators
        const errorResult = await this.checkElementForPatterns(
          page,
          SELECTORS.ERROR_INDICATORS,
          TEXT_PATTERNS.ERROR
        );

        if (errorResult.found) {
          throw new PublishError(`Video publish failed with error: ${errorResult.text}`);
        }

        // Check if we've left the publish page (likely success)
        const stillOnPage = await this.findElementBySelectors(
          page,
          SELECTORS.PUBLISH_PAGE_INDICATORS
        );
        if (!stillOnPage) {
          logger.debug('Left publish page, assuming video publish success');
          return true;
        }

        // Check for processing status
        const processingResult = await this.checkElementForPatterns(
          page,
          SELECTORS.PROCESSING_INDICATORS,
          TEXT_PATTERNS.PROCESSING
        );

        isProcessing = processingResult.found;
        if (isProcessing) {
          logger.debug(`Video still processing: ${processingResult.text}`);
        }

        // Check for toast messages
        const toastResult = await this.checkElementForPatterns(
          page,
          SELECTORS.TOAST_SELECTORS,
          TEXT_PATTERNS.SUCCESS
        );

        if (toastResult.found) {
          logger.debug(`Found success toast: ${toastResult.text}`);
          return true;
        }

        const errorToastResult = await this.checkElementForPatterns(
          page,
          SELECTORS.TOAST_SELECTORS,
          TEXT_PATTERNS.ERROR
        );

        if (errorToastResult.found) {
          throw new PublishError(`Video publish failed: ${errorToastResult.text}`);
        }

        return false;
      },
      VIDEO_TIMEOUTS.COMPLETION_TIMEOUT,
      isProcessing ? 5000 : VIDEO_TIMEOUTS.COMPLETION_CHECK,
      'Video publish completion timeout - could not determine result after 5 minutes'
    );

    // Extract note ID after successful completion
    return await this.extractNoteIdFromPage(page);
  }

  async publishVideo(
    title: string,
    content: string,
    videoPath: string,
    tags: string = '',
    browserPath?: string
  ): Promise<PublishResult> {
    // Validate inputs
    this.validateVideoInputs(title, content, videoPath);

    // Validate and resolve video path
    const resolvedVideoPath = this.validateAndResolveVideoPath(videoPath);

    try {
      const page = await this.getBrowserManager().createPage(false, browserPath, true);

      try {
        const noteId = await this.executeVideoPublishWorkflow(page, title, content, resolvedVideoPath, tags);

        // Save cookies
        await this.getBrowserManager().saveCookiesFromPage(page);

        return {
          success: true,
          message: 'Video published successfully',
          title,
          content,
          imageCount: 0, // Videos don't have image count
          tags,
          url: this.getConfig().xhs.creatorVideoPublishUrl,
          noteId: noteId || undefined,
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      logger.error(`Video publish error: ${error}`);
      throw error;
    }
  }

  private validateVideoInputs(title: string, content: string, videoPath: string): void {
    if (!title?.trim()) {
      throw new PublishError('Video title cannot be empty');
    }

    // Validate title width for video posts too
    assertTitleWidthValid(title);
    logger.debug(`Video title width validation passed: "${title}" (${getTitleWidth(title)} units)`);

    if (!content?.trim()) {
      throw new PublishError('Video content cannot be empty');
    }

    if (!videoPath?.trim()) {
      throw new PublishError('Video path is required');
    }
  }

  private async executeVideoPublishWorkflow(
    page: Page,
    title: string,
    content: string,
    videoPath: string,
    tags: string
  ): Promise<string | null> {
    // Navigate to video upload page
    await this.getBrowserManager().navigateWithRetry(
      page,
      this.getConfig().xhs.creatorVideoPublishUrl
    );

    // Wait for page to load
    await sleep(VIDEO_TIMEOUTS.PAGE_LOAD);

    // Switch to video upload tab if needed
    await this.clickVideoUploadTab(page);

    // Wait for tab switch to complete
    await sleep(VIDEO_TIMEOUTS.TAB_SWITCH);

    // Upload video
    await this.uploadVideo(page, videoPath);

    // Wait for video to be processed (videos take longer than images)
    await sleep(VIDEO_TIMEOUTS.VIDEO_PROCESSING);

    // Fill in title
    await this.fillTitle(page, title);

    // Wait a bit for content area to appear
    await sleep(VIDEO_TIMEOUTS.CONTENT_WAIT);

    // Fill in content
    await this.fillContent(page, content);

    // Add tags if provided
    if (tags) {
      await this.addTags(page, tags);
    }

    // Submit the video
    await this.submitPost(page);

    // Wait for completion and check result (videos need longer timeout)
    return await this.waitForVideoPublishCompletion(page);
  }

  private validateAndResolveVideoPath(videoPath: string): string {
    const resolvedPath = join(process.cwd(), videoPath);

    if (!existsSync(resolvedPath)) {
      throw new PublishError(`Video file not found: ${videoPath}`);
    }

    const stats = statSync(resolvedPath);
    if (!stats.isFile()) {
      throw new PublishError(`Path is not a file: ${videoPath}`);
    }

    // Check file extension
    const ext = videoPath.toLowerCase().split('.').pop();
    const allowedExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'];
    if (!ext || !allowedExtensions.includes(ext)) {
      throw new PublishError(
        `Unsupported video format: ${videoPath}. Supported: ${allowedExtensions.join(', ')}`
      );
    }

    // Check file size (XHS typically has limits)
    const maxSizeInMB = 500; // 500MB limit
    const fileSizeInMB = stats.size / (1024 * 1024);
    if (fileSizeInMB > maxSizeInMB) {
      throw new PublishError(
        `Video file too large: ${fileSizeInMB.toFixed(2)}MB. Maximum allowed: ${maxSizeInMB}MB`
      );
    }

    return resolvedPath;
  }

  private async clickVideoUploadTab(page: Page): Promise<void> {
    try {
      // Try multiple selectors for video tab
      const videoTabSelectors = [
        'div.creator-tab',
        '.creator-tab',
        '[role="tab"]',
        '.tab',
        'div[class*="tab"]',
      ];

      let tabs: any[] = [];
      for (const selector of videoTabSelectors) {
        const foundTabs = await page.$$(selector);
        if (foundTabs.length > 0) {
          tabs = foundTabs;
          break;
        }
      }

      if (tabs.length === 0) {
        logger.warn('No tabs found for video upload');
        return;
      }

      // Look for the video upload tab specifically
      let videoTab: any = null;
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        try {
          const isVisible = await tab.isIntersectingViewport();
          if (!isVisible) continue;

          const text = await page.evaluate((el) => el.textContent, tab);

          // Check if this is the video upload tab
          if (
            text &&
            (text.includes('上传视频') || text.includes('视频') || text.includes('video'))
          ) {
            videoTab = tab;
            break;
          }
        } catch (error) {
          // Ignore individual tab errors
        }
      }

      if (videoTab) {
        await videoTab.click();
        await sleep(2000); // Wait for tab switch
      } else {
        // Fallback: click the first tab (usually video upload)
        const visibleTabs: any[] = [];
        for (const tab of tabs) {
          const isVisible = await tab.isIntersectingViewport();
          if (isVisible) {
            visibleTabs.push(tab);
          }
        }

        if (visibleTabs.length > 0) {
          await visibleTabs[0].click(); // Usually the first tab is video upload
          await sleep(2000);
        }
      }
    } catch (error) {
      logger.warn(`Failed to click video upload tab: ${error}`);
    }
  }

  private async uploadVideo(page: Page, videoPath: string): Promise<void> {
    logger.debug(`Uploading video: ${videoPath}`);

    // Find file input element
    const fileInput = await this.findElementBySelectors(page, SELECTORS.FILE_INPUT);
    if (!fileInput) {
      throw new PublishError('Could not find file upload input on video upload page');
    }

    try {
      // Wait for the input to be ready
      await sleep(VIDEO_TIMEOUTS.UPLOAD_READY);

      // Upload the video file
      await fileInput.uploadFile(videoPath);
      logger.debug('Video file uploaded, waiting for processing...');

      // Wait for upload to start and show progress
      await sleep(VIDEO_TIMEOUTS.UPLOAD_START);

      // Wait for video processing to complete (this can take a while)
      await this.waitForVideoProcessing(page);
    } catch (error) {
      throw new PublishError(`Failed to upload video ${videoPath}: ${error}`);
    }
  }

  private async waitForVideoProcessing(page: Page): Promise<void> {
    logger.debug('Waiting for video processing to complete...');

    try {
      await this.waitForCondition(
        async () => {
          // Check if processing is complete
          const completeResult = await this.checkElementForPatterns(
            page,
            SELECTORS.COMPLETION_INDICATORS,
            TEXT_PATTERNS.SUCCESS
          );

          if (completeResult.found) {
            logger.debug(`Video processing complete: ${completeResult.text}`);
            return true;
          }

          // Check if still processing
          const processingResult = await this.checkElementForPatterns(
            page,
            SELECTORS.PROCESSING_INDICATORS,
            TEXT_PATTERNS.PROCESSING
          );

          if (processingResult.found) {
            logger.debug(`Video processing: ${processingResult.text}`);
            return false; // Still processing, continue waiting
          }

          // If not processing and no completion indicator, assume it's done
          logger.debug('No processing indicators found, assuming video processing complete');
          return true;
        },
        VIDEO_TIMEOUTS.PROCESSING_TIMEOUT,
        VIDEO_TIMEOUTS.PROCESSING_CHECK,
        'Video processing timeout'
      );
    } catch (error) {
      logger.warn('Video processing timeout, continuing anyway...');
    }
  }

}
