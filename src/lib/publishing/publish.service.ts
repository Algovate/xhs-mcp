/**
 * Publishing service for XHS MCP Server
 */

import { Page } from 'puppeteer';
import { Config, PublishResult } from '../shared/types.js';
import { PublishError, InvalidImageError } from '../shared/errors.js';
import { BaseService } from '../shared/base.service.js';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { logger } from '../shared/logger.js';
import { sleep } from '../shared/utils.js';

// Constants for video publishing
const VIDEO_TIMEOUTS = {
  PAGE_LOAD: 3000,
  TAB_SWITCH: 2000,
  VIDEO_PROCESSING: 10000,
  CONTENT_WAIT: 1000,
  UPLOAD_READY: 1000,
  UPLOAD_START: 3000,
  PROCESSING_CHECK: 3000,
  COMPLETION_CHECK: 2000,
  PROCESSING_TIMEOUT: 120000, // 2 minutes
  COMPLETION_TIMEOUT: 300000, // 5 minutes
} as const;

const SELECTORS = {
  FILE_INPUT: [
    'input[type=file]',
    '.upload-input',
    'input[accept*="video"]',
    'input[accept*="mp4"]',
    'input[class*="upload"]',
    'input[class*="file"]'
  ],
  SUCCESS_INDICATORS: [
    '.success-message',
    '.publish-success',
    '[data-testid="publish-success"]',
    '.toast-success',
    '.upload-success',
    '.video-upload-success',
    '.video-processing-complete',
    '.upload-complete'
  ],
  ERROR_INDICATORS: [
    '.error-message',
    '.publish-error',
    '[data-testid="publish-error"]',
    '.toast-error',
    '.error-toast',
    '.upload-error',
    '.video-upload-error'
  ],
  PROCESSING_INDICATORS: [
    '.video-processing',
    '.upload-progress',
    '.processing-indicator',
    '[class*="processing"]',
    '[class*="uploading"]',
    '.progress-bar',
    '.upload-status'
  ],
  COMPLETION_INDICATORS: [
    '.upload-complete',
    '.processing-complete',
    '.video-ready',
    '[class*="complete"]',
    '[class*="ready"]'
  ],
  TOAST_SELECTORS: [
    '.toast',
    '.message',
    '.notification',
    '[role="alert"]',
    '.ant-message',
    '.el-message'
  ],
  PUBLISH_PAGE_INDICATORS: [
    'div.upload-content',
    'div.submit',
    '.creator-editor',
    '.video-upload-container',
    'input[type="file"]'
  ]
} as const;

const TEXT_PATTERNS = {
  SUCCESS: ['成功', 'success', '完成'],
  ERROR: ['失败', 'error', '错误'],
  PROCESSING: ['处理中', '上传中', 'processing', 'uploading', '进度']
} as const;

export class PublishService extends BaseService {
  constructor(config: Config) {
    super(config);
  }

  // Helper methods for element detection and text matching
  private async findElementBySelectors(page: Page, selectors: readonly string[]): Promise<any | null> {
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        logger.debug(`Found element with selector: ${selector}`);
        return element;
      }
    }
    return null;
  }

  private async getElementText(element: any): Promise<string | null> {
    try {
      return await element.page().evaluate((el: any) => el.textContent, element);
    } catch (error) {
      logger.warn(`Failed to get element text: ${error}`);
      return null;
    }
  }

  private async checkTextPatterns(text: string | null, patterns: readonly string[]): Promise<boolean> {
    if (!text) return false;
    return patterns.some(pattern => text.includes(pattern));
  }

  private async checkElementForPatterns(
    page: Page,
    selectors: readonly string[],
    patterns: readonly string[]
  ): Promise<{ found: boolean; text?: string; element?: any }> {
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        const text = await this.getElementText(element);
        if (text && await this.checkTextPatterns(text, patterns)) {
          return { found: true, text, element };
        }
      }
    }
    return { found: false };
  }

  private async waitForCondition(
    condition: () => Promise<boolean>,
    timeout: number,
    checkInterval: number = 1000,
    errorMessage: string
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await sleep(checkInterval);
    }

    throw new PublishError(errorMessage);
  }

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

    if (!content?.trim()) {
      throw new PublishError('Note content cannot be empty');
    }

    if (!imagePaths || imagePaths.length === 0) {
      throw new PublishError('At least one image is required');
    }

    // Validate and resolve image paths
    const resolvedPaths = this.validateAndResolveImagePaths(imagePaths);

    // Wait for upload container selector
    const uploadSelector = 'div.upload-content';

    try {
      const page = await this.getBrowserManager().createPage(false, browserPath, true);

      try {
        await this.getBrowserManager().navigateWithRetry(page, this.getConfig().xhs.creatorPublishUrl);

        // Wait for page to load
        await sleep(3000);

        // First, try to switch to the image/text upload tab
        await this.clickUploadTab(page);

        // Wait for tab switch to complete
        await sleep(2000);

        let hasUploadContainer = await this.getBrowserManager().waitForSelectorSafe(page, uploadSelector, 30000);

        if (!hasUploadContainer) {
          // Try alternative selectors for upload container
          const alternativeSelectors = [
            'div.upload-content',
            '.upload-content',
            'div[class*="upload"]',
            'div[class*="image"]',
            'input[type="file"]'
          ];

          for (const selector of alternativeSelectors) {
            hasUploadContainer = await this.getBrowserManager().waitForSelectorSafe(page, selector, 10000);
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

        // Wait for images to be processed
        await sleep(3000);

        // Wait a bit for the page to settle after image upload
        await sleep(2000);

        // Fill in title
        await this.fillTitle(page, title);

        // Wait a bit more for content area to appear
        await sleep(1000);

        // Fill in content
        await this.fillContent(page, content);

        // Add tags if provided
        if (tags) {
          await this.addTags(page, tags);
        }

        // Submit the note
        await this.submitPublish(page);

        // Wait for completion and check result
        await this.waitForPublishCompletion(page);

        // Save cookies
        await this.getBrowserManager().saveCookiesFromPage(page);

        return {
          success: true,
          message: 'Note published successfully',
          title,
          content,
          imageCount: resolvedPaths.length,
          tags,
          url: this.getConfig().xhs.creatorPublishUrl
        };

      } finally {
        await page.close();
      }
    } catch (error) {
      logger.error(`Publish error: ${error}`);
        throw error;
    }
  }

  private validateAndResolveImagePaths(imagePaths: string[]): string[] {
    const resolvedPaths: string[] = [];

    for (const imagePath of imagePaths) {
      const resolvedPath = join(process.cwd(), imagePath);

      if (!existsSync(resolvedPath)) {
        throw new InvalidImageError(`Image file not found: ${imagePath}`);
      }

      const stats = statSync(resolvedPath);
      if (!stats.isFile()) {
        throw new InvalidImageError(`Path is not a file: ${imagePath}`);
      }

      // Check file extension
      const ext = imagePath.toLowerCase().split('.').pop();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      if (!ext || !allowedExtensions.includes(ext)) {
        throw new InvalidImageError(`Unsupported image format: ${imagePath}. Supported: ${allowedExtensions.join(', ')}`);
      }

      resolvedPaths.push(resolvedPath);
    }

    if (resolvedPaths.length > 18) {
      throw new PublishError('Maximum 18 images allowed');
    }

    return resolvedPaths;
  }

  private async clickUploadTab(page: Page): Promise<void> {
    try {
      // Try multiple selectors for tabs
      const tabSelectors = [
        'div.creator-tab',
        '.creator-tab',
        '[role="tab"]',
        '.tab',
        'div[class*="tab"]'
      ];

      let tabs: any[] = [];
      for (const selector of tabSelectors) {
        const foundTabs = await page.$$(selector);
        if (foundTabs.length > 0) {
          tabs = foundTabs;
          break;
        }
      }

      if (tabs.length === 0) {
        logger.warn('No tabs found');
        return;
      }

      // Look for the "上传图文" (upload image/text) tab specifically
      let imageTextTab: any = null;
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        try {
          const isVisible = await tab.isIntersectingViewport();
          if (!isVisible) continue;

          const text = await page.evaluate(el => el.textContent, tab);

          // Check if this is the image/text upload tab
          if (text && (text.includes('上传图文') || text.includes('图文') || text.includes('图片'))) {
            imageTextTab = tab;
            break;
          }
        } catch (error) {
          // Ignore individual tab errors
        }
      }

      if (imageTextTab) {
        await imageTextTab.click();
        await sleep(2000); // Wait for tab switch
      } else {
        // Fallback: click the second tab (usually image/text upload)
        const visibleTabs: any[] = [];
        for (const tab of tabs) {
          const isVisible = await tab.isIntersectingViewport();
          if (isVisible) {
            visibleTabs.push(tab);
          }
        }

        if (visibleTabs.length > 1) {
          await visibleTabs[1].click(); // Usually the second tab is image/text
          await sleep(2000);
        } else if (visibleTabs.length > 0) {
          await visibleTabs[0].click();
          await sleep(2000);
        }
      }
    } catch (error) {
      logger.warn(`Failed to click upload tab: ${error}`);
    }
  }

  private async uploadImages(page: Page, imagePaths: string[]): Promise<void> {
    // Try primary file input selector
    let fileInput = await page.$('input[type=file]');

    if (!fileInput) {
      // Fallback to alternative selector
      fileInput = await page.$('.upload-input');

      if (!fileInput) {
        throw new PublishError('Could not find file upload input on page');
      }
    }

    // Upload each image
    for (const imagePath of imagePaths) {
      try {
        await fileInput.uploadFile(imagePath);
        await sleep(1000); // Wait between uploads
      } catch (error) {
        throw new PublishError(`Failed to upload image ${imagePath}: ${error}`);
      }
    }
  }

  private async fillTitle(page: Page, title: string): Promise<void> {
    const titleSelectors = [
      'input[placeholder*="标题"]',
      'input[placeholder*="title"]',
      'input[data-placeholder*="标题"]',
      '.title-input input',
      'input[type="text"]',
      'input[placeholder*="请输入标题"]',
      'input[placeholder*="标题"]',
      'input[name="title"]',
      'input[id*="title"]',
      'input[class*="title"]',
      'div[contenteditable="true"]',
      'textarea[placeholder*="标题"]',
      'textarea[placeholder*="title"]'
    ];

    for (const selector of titleSelectors) {
      try {
        const titleInput = await page.$(selector);
        if (titleInput) {
          const isVisible = await titleInput.isIntersectingViewport();

          if (isVisible) {
            await titleInput.click();
            await sleep(500); // Wait for focus
            await titleInput.type(title);
            return;
          }
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    // If no input found, try to find any input or textarea on the page
    try {
      const allInputs = await page.$$('input, textarea, [contenteditable="true"]');

      for (let i = 0; i < allInputs.length; i++) {
        const input = allInputs[i];
        try {
          const isVisible = await input.isIntersectingViewport();
          const tagName = await page.evaluate(el => el.tagName, input);

          if (isVisible && (tagName === 'INPUT' || tagName === 'TEXTAREA')) {
            await input.click();
            await sleep(500);
            await input.type(title);
            return;
          }
        } catch (error) {
          // Continue to next input
        }
      }
    } catch (error) {
      // Fall through to error
    }

    throw new PublishError('Could not find title input field');
  }

  private async findContentElement(page: Page): Promise<any | null> {
    // Strategy 1: Try div.ql-editor (primary selector)
    const qlEditor = await page.$('div.ql-editor');
    if (qlEditor) {
      return qlEditor;
    }

    // Strategy 2: Try to find textarea or contenteditable
    const contentSelectors = [
      'textarea[placeholder*="正文"]',
      'div[contenteditable="true"]',
      'div[data-placeholder*="正文"]',
      '.content-editor',
      'div[role="textbox"]'
    ];

    for (const selector of contentSelectors) {
      const element = await page.$(selector);
      if (element) {
        return element;
      }
    }

    return null;
  }

  private async findTextboxByPlaceholder(page: Page): Promise<any | null> {
    try {
      // Find all p elements
      const pElements = await page.$$('p');

      // Look for element with data-placeholder containing "输入正文描述"
      for (const p of pElements) {
        const placeholder = await page.evaluate(el => el.getAttribute('data-placeholder'), p);
        if (placeholder?.includes('输入正文描述')) {
          return p;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async findTextboxParent(page: Page, element: any): Promise<any | null> {
    try {
      return await page.evaluateHandle(el => el.parentElement, element);
    } catch (error) {
      return null;
    }
  }

  private async fillContent(page: Page, content: string): Promise<void> {
    // Wait for content area to appear
    try {
      await page.waitForSelector('div[contenteditable="true"], textarea, [role="textbox"], .ql-editor', { timeout: 10000 });
    } catch (error) {
      // Continue without waiting
    }

    let contentElement = await this.findContentElement(page);

    if (!contentElement) {
      // Try alternative approach
      const textboxElement = await this.findTextboxByPlaceholder(page);
      if (textboxElement) {
        contentElement = await this.findTextboxParent(page, textboxElement);
      }
    }

    if (!contentElement) {
      // Try to find any contenteditable or textarea element
      try {
        const allContentElements = await page.$$('div[contenteditable="true"], textarea, [role="textbox"], .ql-editor, p[contenteditable="true"]');

        for (let i = 0; i < allContentElements.length; i++) {
          const element = allContentElements[i];
          try {
            const isVisible = await element.isIntersectingViewport();
            const tagName = await page.evaluate(el => el.tagName, element);
            const contentEditable = await page.evaluate(el => el.getAttribute('contenteditable'), element);
            const role = await page.evaluate(el => el.getAttribute('role'), element);
            const className = await page.evaluate(el => el.className, element);

            if (isVisible && (contentEditable === 'true' || tagName === 'TEXTAREA' || role === 'textbox' || className.includes('ql-editor'))) {
              contentElement = element;
              break;
            }
          } catch (error) {
            // Continue to next element
          }
        }
      } catch (error) {
        // Continue to next strategy
      }
    }

    if (!contentElement) {
      // Last resort: try to find any element that might be for content
      try {
        const allElements = await page.$$('*');

        for (let i = 0; i < Math.min(allElements.length, 50); i++) { // Limit to first 50 elements
          const element = allElements[i];
          try {
            const isVisible = await element.isIntersectingViewport();
            const tagName = await page.evaluate(el => el.tagName, element);
            const contentEditable = await page.evaluate(el => el.getAttribute('contenteditable'), element);
            const className = await page.evaluate(el => el.className, element);
            const placeholder = await page.evaluate(el => el.getAttribute('placeholder'), element);

            if (isVisible && (contentEditable === 'true' || tagName === 'TEXTAREA' ||
                className.includes('content') || className.includes('editor') ||
                placeholder?.includes('内容') || placeholder?.includes('正文'))) {
              contentElement = element;
              break;
            }
          } catch (error) {
            // Ignore errors for individual elements
          }
        }
      } catch (error) {
        // Fall through to error
      }
    }

    if (!contentElement) {
      throw new PublishError('Could not find content input field');
    }

    try {
      await contentElement.click();
      await sleep(500); // Wait for focus
      await contentElement.type(content);
    } catch (error) {
      throw new PublishError(`Failed to fill content: ${error}`);
    }
  }

  private async inputTags(contentElement: any, tags: string): Promise<void> {
    const tagList = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

    for (const tag of tagList) {
      await this.inputTag(contentElement, tag);
    }
  }

  private async inputTag(contentElement: any, tag: string): Promise<void> {
    try {
      // Try to find topic suggestion container
      const page = contentElement.page();
      const topicContainer = await page.$('#creator-editor-topic-container');

      if (topicContainer) {
        const firstItem = await topicContainer.$('.item');
        if (firstItem) {
          await firstItem.click();
          await sleep(500);
        }
      }

      // Type the tag
      await contentElement.type(`#${tag}`);
      await sleep(500);

      // Press Enter to confirm the tag
      await contentElement.press('Enter');
      await sleep(500);

    } catch (error) {
      logger.warn(`Failed to add tag ${tag}: ${error}`);
    }
  }

  private async addTags(page: Page, tags: string): Promise<void> {
    try {
      const contentElement = await this.findContentElement(page);
      if (contentElement) {
        await this.inputTags(contentElement, tags);
      }
    } catch (error) {
      logger.warn(`Failed to add tags: ${error}`);
    }
  }

  private async submitPublish(page: Page): Promise<void> {
    const submitSelector = 'div.submit div.d-button-content';
    const submitButton = await page.$(submitSelector);

    if (!submitButton) {
      throw new PublishError('Could not find submit button');
    }

    // Wait for submit button to be visible
    await page.waitForSelector(submitSelector, { visible: true, timeout: 10000 });

    try {
      await submitButton.click();
      await sleep(2000);
    } catch (error) {
      throw new PublishError(`Failed to click submit button: ${error}`);
    }
  }

  private async isElementVisible(element: any): Promise<boolean> {
    try {
      return await element.isIntersectingViewport();
    } catch (error) {
      return false;
    }
  }

  private async waitForPublishCompletion(page: Page): Promise<void> {
    const maxWaitTime = 60000; // 60 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
        // Check for success indicators
        const successIndicators = [
        '.success-message',
          '.publish-success',
        '[data-testid="publish-success"]',
        '.toast-success'
        ];

        for (const selector of successIndicators) {
        const element = await page.$(selector);
        if (element) {
            await sleep(2000); // Wait a bit more for any final processing
            return;
          }
        }

        // Check for error indicators
        const errorIndicators = [
          '.error-message',
          '.publish-error',
        '[data-testid="publish-error"]',
        '.toast-error',
        '.error-toast'
        ];

        for (const selector of errorIndicators) {
        const element = await page.$(selector);
        if (element) {
          const errorText = await page.evaluate(el => el.textContent, element);
            throw new PublishError(`Publish failed with error: ${errorText}`);
          }
        }

      // Check if we're still on the publish page
        const publishPageIndicators = [
          'div.upload-content',
        'div.submit',
        '.creator-editor'
        ];

        let stillOnPublishPage = false;
        for (const selector of publishPageIndicators) {
        const element = await page.$(selector);
        if (element) {
            stillOnPublishPage = true;
            break;
          }
        }

        if (!stillOnPublishPage) {
          // We've left the publish page, likely successful
          logger.debug('Left publish page, assuming success');
          return;
        }

      // Check for toast messages
        const toastSelectors = [
          '.toast',
        '.message',
          '.notification',
        '[role="alert"]'
        ];

        for (const selector of toastSelectors) {
        const element = await page.$(selector);
        if (element) {
          const toastText = await page.evaluate(el => el.textContent, element);
            if (toastText) {
            if (toastText.includes('成功') || toastText.includes('success')) {
              logger.debug(`Found success toast: ${toastText}`);
              return;
            } else if (toastText.includes('失败') || toastText.includes('error') || toastText.includes('错误')) {
                throw new PublishError(`Publish failed: ${toastText}`);
            }
          }
        }
      }

      await sleep(1000); // Wait before next check
    }

    throw new PublishError('Publish completion timeout - could not determine result');
  }

  private async waitForVideoPublishCompletion(page: Page): Promise<void> {
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
        const stillOnPage = await this.findElementBySelectors(page, SELECTORS.PUBLISH_PAGE_INDICATORS);
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
  }

  // Unified publish method for both images and videos
  async publishContent(
    type: 'image' | 'video',
    title: string,
    content: string,
    mediaPaths: string[],
    tags: string = '',
    browserPath?: string
  ): Promise<PublishResult> {
    // Validate inputs
    this.validateContentInputs(type, title, content, mediaPaths);

    if (type === 'image') {
      return await this.publishNote(title, content, mediaPaths, tags, browserPath);
    } else {
      // For videos, only take the first path
      const videoPath = mediaPaths[0];
      return await this.publishVideo(title, content, videoPath, tags, browserPath);
    }
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
        await this.executeVideoPublishWorkflow(page, title, content, resolvedVideoPath, tags);

        // Save cookies
        await this.getBrowserManager().saveCookiesFromPage(page);

        return {
          success: true,
          message: 'Video published successfully',
          title,
          content,
          imageCount: 0, // Videos don't have image count
          tags,
          url: this.getConfig().xhs.creatorVideoPublishUrl
        };

      } finally {
        await page.close();
      }
    } catch (error) {
      logger.error(`Video publish error: ${error}`);
      throw error;
    }
  }

  private validateContentInputs(
    type: 'image' | 'video',
    title: string,
    content: string,
    mediaPaths: string[]
  ): void {
    if (!title?.trim()) {
      throw new PublishError(`${type === 'image' ? 'Image' : 'Video'} title cannot be empty`);
    }

    if (!content?.trim()) {
      throw new PublishError(`${type === 'image' ? 'Image' : 'Video'} content cannot be empty`);
    }

    if (!mediaPaths || mediaPaths.length === 0) {
      throw new PublishError(`${type === 'image' ? 'Image' : 'Video'} paths are required`);
    }

    if (type === 'image' && mediaPaths.length > 18) {
      throw new PublishError('Maximum 18 images allowed for image posts');
    }

    if (type === 'video' && mediaPaths.length !== 1) {
      throw new PublishError('Video publishing requires exactly one video file');
    }
  }

  private validateVideoInputs(title: string, content: string, videoPath: string): void {
    if (!title?.trim()) {
      throw new PublishError('Video title cannot be empty');
    }

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
  ): Promise<void> {
    // Navigate to video upload page
    await this.getBrowserManager().navigateWithRetry(page, this.getConfig().xhs.creatorVideoPublishUrl);

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
    await this.submitPublish(page);

    // Wait for completion and check result (videos need longer timeout)
    await this.waitForVideoPublishCompletion(page);
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
      throw new PublishError(`Unsupported video format: ${videoPath}. Supported: ${allowedExtensions.join(', ')}`);
    }

    // Check file size (XHS typically has limits)
    const maxSizeInMB = 500; // 500MB limit
    const fileSizeInMB = stats.size / (1024 * 1024);
    if (fileSizeInMB > maxSizeInMB) {
      throw new PublishError(`Video file too large: ${fileSizeInMB.toFixed(2)}MB. Maximum allowed: ${maxSizeInMB}MB`);
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
        'div[class*="tab"]'
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

          const text = await page.evaluate(el => el.textContent, tab);

          // Check if this is the video upload tab
          if (text && (text.includes('上传视频') || text.includes('视频') || text.includes('video'))) {
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