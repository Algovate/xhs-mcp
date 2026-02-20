import { assertTitleWidthValid, getTitleWidth } from '../../shared/title-validator';
import { Page } from 'puppeteer';
import { PublishResult } from '../../shared/types';
import { PublishError, InvalidImageError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { sleep } from '../../shared/utils';
import { existsSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PublishBaseService } from './publish-base.service';

export class ImagePublishService extends PublishBaseService {
  async publishNote(
    title: string,
    content: string,
    imagePaths: string[],
    tags: string = '',
    browserPath?: string
  ): Promise<PublishResult> {
    // Validate inputs
    if (!title?.trim()) {
      throw new PublishError('Note title cannot be empty');
    }

    // Validate title width (CJK characters count as 2 units, ASCII as 1)
    assertTitleWidthValid(title);
    logger.debug(`Title width validation passed: "${title}" (${getTitleWidth(title)} units)`);

    if (!content?.trim()) {
      throw new PublishError('Note content cannot be empty');
    }

    if (!imagePaths || imagePaths.length === 0) {
      throw new PublishError('At least one image is required');
    }

    // Process image paths - download URLs and validate local paths
    const resolvedPaths = await this.validateAndResolveImagePaths(imagePaths);

    // Wait for upload container selector
    const uploadSelector = 'div.upload-content';

    try {
      const page = await this.getBrowserManager().createPage(false, browserPath, true);

      try {
        await this.getBrowserManager().navigateWithRetry(
          page,
          this.getConfig().xhs.creatorPublishUrl
        );

        // Wait for page to load
        await sleep(3000);

        // First, try to switch to the image/text upload tab
        await this.clickUploadTab(page);

        // Wait for tab switch to complete
        await sleep(3000);

        // Check if tab switch was successful and retry if needed
        const pageState = await page.evaluate(() => {
          return {
            buttonTexts: Array.from(document.querySelectorAll('button, div[role="button"]'))
              .map((el: Element) => el.textContent?.trim())
              .filter((t: string | undefined) => t),
          };
        });

        // If still showing video upload, try clicking the tab again
        if (
          pageState.buttonTexts.includes('上传视频') &&
          !pageState.buttonTexts.includes('上传图文')
        ) {
          await this.clickUploadTab(page);
          await sleep(3000);
        }

        let hasUploadContainer = await this.getBrowserManager().tryWaitForSelector(
          page,
          uploadSelector,
          30000
        );

        if (!hasUploadContainer) {
          // Try alternative selectors for upload container
          const alternativeSelectors = [
            'div.upload-content',
            '.upload-content',
            'div[class*="upload"]',
            'div[class*="image"]',
            'input[type="file"]',
          ];

          for (const selector of alternativeSelectors) {
            hasUploadContainer = await this.getBrowserManager().tryWaitForSelector(
              page,
              selector,
              10000
            );
            if (hasUploadContainer) {
              break;
            }
          }
        }

        if (!hasUploadContainer) {
          throw new PublishError('Could not find upload container on publish page');
        }

        // Upload images
        await this.uploadImages(page, resolvedPaths);

        // Wait for images to be processed (large files need more time on XHS)
        logger.debug('Waiting 15 seconds for images to be uploaded and processed...');
        await sleep(15000);

        // Wait for page to transition to edit mode (check for title or content input)
        try {
          await page.waitForSelector(
            'input[placeholder*="标题"], div[contenteditable="true"], .tiptap.ProseMirror',
            { timeout: 15000 }
          );
        } catch (error) {
          // Continue without waiting
        }

        // Wait a bit for the page to settle after image upload
        await sleep(2000);

        // Fill in title
        await this.fillTitle(page, title);

        // Wait a bit more for content area to appear
        await sleep(2000);

        // Fill in content
        await this.fillContent(page, content);

        // Add tags if provided
        if (tags) {
          await this.addTags(page, tags);
        }

        // Submit the note
        await this.submitPost(page);

        // Wait for completion and check result
        const noteId = await this.waitForPublishCompletion(page);

        // Save cookies
        await this.getBrowserManager().saveCookiesFromPage(page);

        return {
          success: true,
          message: 'Note published successfully',
          title,
          content,
          imageCount: resolvedPaths.length,
          tags,
          url: this.getConfig().xhs.creatorPublishUrl,
          noteId: noteId || undefined,
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      logger.error(`Publish error: ${error}`);
      throw error;
    }
  }

  /**
   * Process image paths - download URLs and validate local paths
   */
  private async validateAndResolveImagePaths(imagePaths: string[]): Promise<string[]> {
    // Use ImageDownloader to process paths (downloads URLs, validates local paths)
    const resolvedPaths = await this.imageDownloader.processImagePaths(imagePaths);

    // Validate resolved paths
    for (const resolvedPath of resolvedPaths) {
      // For local paths that aren't absolute, resolve them
      const fullPath =
        resolvedPath.startsWith('/') || resolvedPath.match(/^[a-zA-Z]:/)
          ? resolvedPath
          : join(process.cwd(), resolvedPath);

      if (!existsSync(fullPath)) {
        throw new InvalidImageError(`Image file not found: ${resolvedPath}`);
      }

      const stats = statSync(fullPath);
      if (!stats.isFile()) {
        throw new InvalidImageError(`Path is not a file: ${resolvedPath}`);
      }

      // Check file extension
      const ext = resolvedPath.toLowerCase().split('.').pop();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
      if (!ext || !allowedExtensions.includes(ext)) {
        throw new InvalidImageError(
          `Unsupported image format: ${resolvedPath}. Supported: ${allowedExtensions.join(', ')}`
        );
      }
    }

    if (resolvedPaths.length > 18) {
      throw new PublishError('Maximum 18 images allowed');
    }

    return resolvedPaths;
  }

  private async clickUploadTab(page: Page): Promise<void> {
    try {
      logger.debug('Attempting to switch to "上传图文" tab using Puppeteer outer native click');

      // Wait for tabs to render
      await page.waitForSelector('.creator-tab', { timeout: 10000 });

      const tabs = await page.$$('.creator-tab');
      let clicked = false;

      for (const tab of tabs) {
        const text = await tab.evaluate(el => el.textContent);
        if (text && (text.includes('上传图文') || text.includes('图文'))) {

          const isVisible = await tab.isIntersectingViewport();
          if (!isVisible) {
            logger.debug('Found a matching tab, but it is not visible in the viewport. Skipping...');
            continue; // Skip hidden elements
          }

          // Try native click first
          try {
            await (tab as any).click({ delay: 150 });
            logger.debug('Native Puppeteer click succeeded on tab.');
          } catch (e) {
            logger.debug(`Puppeteer native click failed on visible tab: ${e}`);
          }
          await sleep(500);

          // Force a secondary click on the text itself via evaluate just in case hit area missed
          await tab.evaluate((el) => {
            const span = el.querySelector('span') || el;
            (span as HTMLElement).click();
          });

          clicked = true;
          logger.debug('Successfully clicked image tab text match.');
          break;
        }
      }

      if (!clicked) {
        logger.warn('Could not find visible image tab via textual matching.');
      }

      await sleep(2000);
    } catch (error) {
      logger.warn(`Failed to click upload tab: ${error}`);
    }
  }

  private async uploadImages(page: Page, imagePaths: string[]): Promise<void> {
    try {
      logger.debug('Uploading images using direct input element targeting');

      const fileInput = await page.$('input[type="file"]');
      if (!fileInput) {
        throw new PublishError('Could not find file upload input on page');
      }

      // Ensure the input accepts multiple files and any type to avoid frontend blocks
      await page.evaluate((el: Element | null) => {
        if (el) {
          el.setAttribute('multiple', 'multiple');
          el.removeAttribute('accept');
        }
      }, fileInput);

      logger.debug(`Submitting ${imagePaths.length} image paths to file input element`);
      await fileInput.uploadFile(...imagePaths);

      // Dispatch a change event manually in case the framework missed it
      await page.evaluate((el: Element | null) => {
        if (el) {
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, fileInput);

      await sleep(15000);
    } catch (error) {
      throw new PublishError(`Failed to upload images: ${error}`);
    }
  }

}
