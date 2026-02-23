/**
 * Publishing service for XHS MCP Server
 */

import { Page } from 'puppeteer';
import { Config, PublishResult } from '../../shared/types';
import { PublishError, InvalidImageError } from '../../shared/errors';
import { BaseService } from '../../shared/base.service';
import { existsSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../../shared/logger';
import { sleep } from '../../shared/utils';
import { ImageDownloader } from '../../shared/image-downloader';
import { assertTitleWidthValid, getTitleWidth } from '../../shared/title-validator';
import { COMMON_STATUS_SELECTORS, COMMON_TEXT_PATTERNS, COMMON_FILE_SELECTORS } from '../../shared/selectors';

// Constants for video publishing
export const VIDEO_TIMEOUTS = {
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

export const SELECTORS = {
  FILE_INPUT: COMMON_FILE_SELECTORS.FILE_INPUT,
  SUCCESS_INDICATORS: COMMON_STATUS_SELECTORS.SUCCESS,
  ERROR_INDICATORS: COMMON_STATUS_SELECTORS.ERROR,
  PROCESSING_INDICATORS: COMMON_STATUS_SELECTORS.PROCESSING,
  COMPLETION_INDICATORS: [
    '.upload-complete',
    '.processing-complete',
    '.video-ready',
    '[class*="complete"]',
    '[class*="ready"]',
  ],
  TOAST_SELECTORS: COMMON_STATUS_SELECTORS.TOAST,
  PUBLISH_PAGE_INDICATORS: [
    'div.upload-content',
    'div.submit',
    '.creator-editor',
    '.video-upload-container',
    'input[type="file"]',
  ],
} as const;

export const TEXT_PATTERNS = COMMON_TEXT_PATTERNS;


export abstract class PublishBaseService extends BaseService {
  protected imageDownloader: ImageDownloader;

  constructor(config: Config) {
    super(config);
    this.imageDownloader = new ImageDownloader('./temp_images');
  }

  // Helper methods for element detection and text matching
  protected async findElementBySelectors(
    page: Page,
    selectors: readonly string[]
  ): Promise<any | null> {
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        logger.debug(`Found element with selector: ${selector}`);
        return element;
      }
    }
    return null;
  }

  protected async getElementText(element: Element): Promise<string | null> {
    try {
      return await (element as any).page().evaluate((el: Element) => el.textContent, element);
    } catch (error) {
      logger.warn(`Failed to get element text: ${error}`);
      return null;
    }
  }

  protected async checkTextPatterns(
    text: string | null,
    patterns: readonly string[]
  ): Promise<boolean> {
    if (!text) return false;
    return patterns.some((pattern) => text.includes(pattern));
  }

  protected async checkElementForPatterns(
    page: Page,
    selectors: readonly string[],
    patterns: readonly string[]
  ): Promise<{ found: boolean; text?: string; element?: any }> {
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        const text = await this.getElementText(element as unknown as Element);
        if (text && (await this.checkTextPatterns(text, patterns))) {
          return { found: true, text, element };
        }
      }
    }
    return { found: false };
  }

  protected async waitForCondition(
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

  protected async fillTitle(page: Page, title: string): Promise<void> {
    // Wait for a likely title input to appear
    try {
      await page.waitForSelector(
        'input.c-input_inner, input.c-input, input[placeholder*="标题"], .title-input input, input[class*="title"]',
        { timeout: 10000 }
      );
    } catch (error) {
      // Continue without waiting if not found purely by selector
    }

    const titleSelectors = [
      'input.c-input_inner', // specific for recent Xiaohongshu creator UI
      'input.c-input',
      'input[placeholder*="标题"]',
      'input[placeholder*="填写标题会有更多赞哦"]',
      'input[placeholder*="title"]',
      'input[data-placeholder*="标题"]',
      '.title-input input',
      'input[placeholder*="请输入标题"]',
      'input[name="title"]',
      'input[id*="title"]',
      'input[class*="title"]',
      'input[type="text"]', // Fallbacks
      'div[contenteditable="true"]',
      'textarea[placeholder*="标题"]',
      'textarea[placeholder*="title"]',
    ];

    for (const selector of titleSelectors) {
      try {
        const titleInput = await page.$(selector);
        if (titleInput) {
          // Scroll into view just in case it's off screen
          await page.evaluate((el) => {
            if (el && typeof el.scrollIntoView === 'function') {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, titleInput);
          await sleep(500);

          const isVisible = await titleInput.isIntersectingViewport();

          if (isVisible) {
            await titleInput.click();
            await sleep(500); // Wait for focus

            // clear existing input if any
            await titleInput.click({ clickCount: 3 });
            await titleInput.press('Backspace');

            await titleInput.type(title);
            return;
          }
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    // If no specific input found, try to find any visible input or textarea on the page
    try {
      const allInputs = await page.$$('input, textarea');

      for (let i = 0; i < allInputs.length; i++) {
        const input = allInputs[i];
        try {
          const type = await page.evaluate((el) => el.getAttribute('type'), input);

          // avoid file inputs or hidden inputs
          if (type !== 'file' && type !== 'hidden') {
            await page.evaluate((el) => {
              if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, input);
            await sleep(500);

            const isVisible = await input.isIntersectingViewport();

            if (isVisible) {
              await input.click();
              await sleep(500);

              // clear existing input if any
              await input.click({ clickCount: 3 });
              await input.press('Backspace');

              await input.type(title);
              return;
            }
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

  protected async findContentElement(page: Page): Promise<any | null> {
    try {
      // Strategy 1: Try div[contenteditable="true"] (simple and direct)
      const contentEditable = await page.$('div[contenteditable="true"]');
      if (contentEditable) {
        const isVisible = await contentEditable.isIntersectingViewport();
        if (isVisible) {
          return contentEditable;
        }
      }

      // Strategy 2: Try div.tiptap.ProseMirror (primary selector for creator platform)
      const tiptapEditor = await page.$('div.tiptap.ProseMirror');
      if (tiptapEditor) {
        const isVisible = await tiptapEditor.isIntersectingViewport();
        if (isVisible) {
          return tiptapEditor;
        }
      }

      // Strategy 3: Try div[role="textbox"][contenteditable="true"] (specific selector)
      const roleTextbox = await page.$('div[role="textbox"][contenteditable="true"]');
      if (roleTextbox) {
        const isVisible = await roleTextbox.isIntersectingViewport();
        if (isVisible) {
          return roleTextbox;
        }
      }

      // Strategy 4: Try div.ql-editor (legacy selector)
      const qlEditor = await page.$('div.ql-editor');
      if (qlEditor) {
        return qlEditor;
      }

      // Strategy 5: Try to find textarea or contenteditable
      const contentSelectors = [
        '.tiptap.ProseMirror',
        'textarea[placeholder*="正文"]',
        'textarea[multiline]',
        'div[data-placeholder*="正文"]',
        '.content-editor',
        'div[role="textbox"]',
        'textbox[role="textbox"]',
        'textbox[multiline]',
      ];

      for (const selector of contentSelectors) {
        const element = await page.$(selector);
        if (element) {
          return element;
        }
      }

      // Strategy 6: Try to find any multiline textbox (fallback)
      const multilineTextboxes = await page.$$('textbox[multiline]');
      for (const element of multilineTextboxes) {
        const isVisible = await element.isIntersectingViewport();
        if (isVisible) {
          return element;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  protected async findTextboxByPlaceholder(page: Page): Promise<any | null> {
    try {
      // Find all p elements
      const pElements = await page.$$('p');

      // Look for element with data-placeholder containing "输入正文描述"
      for (const p of pElements) {
        const placeholder = await page.evaluate((el) => el.getAttribute('data-placeholder'), p);
        if (placeholder?.includes('输入正文描述')) {
          return p;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  protected async findTextboxParent(page: Page, element: Element): Promise<any> {
    try {
      return await page.evaluateHandle((el) => el.parentElement, element);
    } catch (error) {
      return null;
    }
  }

  protected async fillContent(page: Page, content: string): Promise<void> {
    // Wait for content area to appear
    try {
      await page.waitForSelector(
        'div[role="textbox"][contenteditable="true"], .tiptap.ProseMirror, div[contenteditable="true"], textarea, [role="textbox"], .ql-editor, textbox[multiline]',
        { timeout: 10000 }
      );
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
        const allContentElements = await page.$$(
          'div[role="textbox"][contenteditable="true"], .tiptap.ProseMirror, div[contenteditable="true"], textarea, [role="textbox"], .ql-editor, p[contenteditable="true"], textbox[multiline]'
        );

        for (let i = 0; i < allContentElements.length; i++) {
          const element = allContentElements[i];
          try {
            const isVisible = await element.isIntersectingViewport();
            const tagName = await page.evaluate((el) => el.tagName, element);
            const contentEditable = await page.evaluate(
              (el) => el.getAttribute('contenteditable'),
              element
            );
            const role = await page.evaluate((el) => el.getAttribute('role'), element);
            const className = await page.evaluate((el) => el.className, element);
            const multiline = await page.evaluate((el) => el.getAttribute('multiline'), element);

            if (
              isVisible &&
              (contentEditable === 'true' ||
                tagName === 'TEXTAREA' ||
                role === 'textbox' ||
                className.includes('ql-editor') ||
                className.includes('tiptap') ||
                multiline === '')
            ) {
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

        for (let i = 0; i < Math.min(allElements.length, 50); i++) {
          // Limit to first 50 elements
          const element = allElements[i];
          try {
            const isVisible = await element.isIntersectingViewport();
            const tagName = await page.evaluate((el) => el.tagName, element);
            const contentEditable = await page.evaluate(
              (el) => el.getAttribute('contenteditable'),
              element
            );
            const className = await page.evaluate((el) => el.className, element);
            const placeholder = await page.evaluate(
              (el) => el.getAttribute('placeholder'),
              element
            );

            if (
              isVisible &&
              (contentEditable === 'true' ||
                tagName === 'TEXTAREA' ||
                className.includes('content') ||
                className.includes('editor') ||
                placeholder?.includes('内容') ||
                placeholder?.includes('正文'))
            ) {
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
      await (contentElement as any).type(content);
    } catch (error) {
      throw new PublishError(`Failed to fill content: ${error}`);
    }
  }

  protected async inputTags(page: Page, contentElement: any, tags: string): Promise<void> {
    const tagList = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    for (const tag of tagList) {
      await this.inputTag(page, contentElement, tag);
    }
  }

  protected async inputTag(page: Page, contentElement: any, tag: string): Promise<void> {
    try {
      // Type the tag
      await contentElement.type(`#${tag}`);
      await sleep(1000);

      // Try to find topic suggestion container
      const topicContainer = await page.$('#creator-editor-topic-container');

      if (topicContainer) {
        const firstItem = await topicContainer.$('.item');
        if (firstItem) {
          await firstItem.click();
          await sleep(500);
        }
      } else {
        // Press Enter to confirm the tag
        await contentElement.press('Enter');
        await sleep(500);
        // Press Space to separate tags
        await contentElement.press('Space');
        await sleep(200);
      }
    } catch (error) {
      logger.warn(`Failed to add tag ${tag}: ${error}`);
    }
  }

  protected async addTags(page: Page, tags: string): Promise<void> {
    try {
      const contentElement = await this.findContentElement(page);
      if (contentElement) {
        await this.inputTags(page, contentElement, tags);
      }
    } catch (error) {
      logger.warn(`Failed to add tags: ${error}`);
    }
  }

  protected async submitPost(page: Page): Promise<void> {
    try {
      // Find the submit button by text "发布"
      const buttons = await page.$$('button');
      let submitButton = null;
      for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent?.trim());
        if (text === '发布') {
          submitButton = btn;
          break;
        }
      }

      if (!submitButton) {
        // Try span or div as fallback
        const submitSelector = 'div.submit, .submit-btn, .publish-btn';
        submitButton = await page.$(submitSelector);
        if (!submitButton) {
          throw new PublishError('Could not find submit button');
        }
      }

      await submitButton.click();
      logger.debug('Clicked submit button natively');
      await sleep(2000);
    } catch (error) {
      throw new PublishError(`Failed to click submit button: ${error}`);
    }
  }

  protected async isElementVisible(element: Element): Promise<boolean> {
    try {
      return await (element as any).isIntersectingViewport();
    } catch (error) {
      return false;
    }
  }

  protected async waitForPublishCompletion(page: Page): Promise<string | null> {
    const maxWaitTime = 60000; // 60 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      // Check for success indicators
      const successIndicators = [
        '.success-message',
        '.publish-success',
        '[data-testid="publish-success"]',
        '.toast-success',
      ];

      for (const selector of successIndicators) {
        const element = await page.$(selector);
        if (element) {
          await sleep(2000); // Wait a bit more for any final processing
          return await this.extractNoteIdFromPage(page);
        }
      }

      // Check for error indicators
      const errorIndicators = [
        '.error-message',
        '.publish-error',
        '[data-testid="publish-error"]',
        '.toast-error',
        '.error-toast',
      ];

      for (const selector of errorIndicators) {
        const element = await page.$(selector);
        if (element) {
          const errorText = await page.evaluate((el) => el.textContent, element);
          throw new PublishError(`Publish failed with error: ${errorText}`);
        }
      }

      // Check if we're still on the publish page
      const publishPageIndicators = ['div.upload-content', 'div.submit', '.creator-editor'];

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
        return await this.extractNoteIdFromPage(page);
      }

      // Check for toast messages
      const toastSelectors = ['.toast', '.message', '.notification', '[role="alert"]'];

      for (const selector of toastSelectors) {
        const element = await page.$(selector);
        if (element) {
          const toastText = await page.evaluate((el) => el.textContent, element);
          if (toastText) {
            if (toastText.includes('成功') || toastText.includes('success')) {
              logger.debug(`Found success toast: ${toastText}`);
              return await this.extractNoteIdFromPage(page);
            } else if (
              toastText.includes('失败') ||
              toastText.includes('error') ||
              toastText.includes('错误')
            ) {
              throw new PublishError(`Publish failed: ${toastText}`);
            }
          }
        }
      }

      await sleep(1000); // Wait before next check
    }

    throw new PublishError('Publish completion timeout - could not determine result');
  }

  protected async extractNoteIdFromPage(page: Page): Promise<string | null> {
    try {
      // Method 1: Try to extract from URL if redirected to note page
      const currentUrl = page.url();
      logger.debug(`Current URL after publish: ${currentUrl}`);

      // Check if we're on a note page (URL contains /explore/ or /discovery/)
      const noteIdMatch = currentUrl.match(/\/explore\/([a-f0-9]+)/i) ||
        currentUrl.match(/\/discovery\/([a-f0-9]+)/i);

      if (noteIdMatch && noteIdMatch[1]) {
        const noteId = noteIdMatch[1];
        logger.debug(`Extracted note ID from URL: ${noteId}`);
        return noteId;
      }

      // Method 2: Try to find note ID in page content or data attributes
      const noteIdFromPage = await page.evaluate(() => {
        // Look for data attributes that might contain note ID
        const elementsWithData = document.querySelectorAll('[data-note-id], [data-id], [data-impression]');
        for (let i = 0; i < elementsWithData.length; i++) {
          const element = elementsWithData[i];
          const noteId = element.getAttribute('data-note-id') ||
            element.getAttribute('data-id') ||
            element.getAttribute('data-impression');
          if (noteId && noteId.length > 10) { // Note IDs are typically long
            return noteId;
          }
        }

        // Look for links to note pages
        const noteLinks = document.querySelectorAll('a[href*="/explore/"], a[href*="/discovery/"]');
        for (let i = 0; i < noteLinks.length; i++) {
          const link = noteLinks[i];
          const href = link.getAttribute('href');
          if (href) {
            const match = href.match(/\/explore\/([a-f0-9]+)/i) ||
              href.match(/\/discovery\/([a-f0-9]+)/i);
            if (match && match[1]) {
              return match[1];
            }
          }
        }

        // Look for any text that looks like a note ID (long hex string)
        const textContent = document.body.textContent || '';
        const noteIdPattern = /[a-f0-9]{20,}/gi;
        const matches = textContent.match(noteIdPattern);
        if (matches && matches.length > 0) {
          // Return the first long hex string found
          return matches[0];
        }

        return null;
      });

      if (noteIdFromPage) {
        logger.debug(`Extracted note ID from page content: ${noteIdFromPage}`);
        return noteIdFromPage;
      }

      // Method 3: Try to get the latest note ID using NoteService (fallback)
      logger.debug('Could not extract note ID from page, trying fallback method');
      try {
        // Wait a bit for the note to be processed
        await sleep(5000);

        // Use NoteService to get the latest note ID
        const { NoteService } = await import('../notes/note.service');
        const noteService = new NoteService(this.getConfig());
        const userNotes = await noteService.getUserNotes(1); // Get only the latest note

        if (userNotes.success && userNotes.data && userNotes.data.length > 0) {
          const latestNoteId = userNotes.data[0].id;
          logger.debug(`Extracted note ID from NoteService: ${latestNoteId}`);
          return latestNoteId;
        }
      } catch (error) {
        logger.warn(`Fallback note ID extraction failed: ${error}`);
      }

      logger.debug('Could not extract note ID from any method');
      return null;
    } catch (error) {
      logger.warn(`Failed to extract note ID: ${error}`);
      return null;
    }
  }

  protected validateContentInputs(
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
}