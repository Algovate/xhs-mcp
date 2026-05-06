/**
 * Delete service for XHS MCP Server
 * Handles note deletion operations
 */

import type { Config, XHSResponse } from '../../shared/types';
import { BaseService } from '../../shared/base.service';
import { BrowserManager } from '../browser/browser.manager';
import { logger } from '../../shared/logger';
import { sleep } from '../../shared/utils';
import { DeleteError } from '../../shared/errors';
import { navigateToCreatorCenter, verifyCreatorAuth } from '../../shared/creator-center';
import { Page } from 'puppeteer';
import { COMMON_BUTTON_SELECTORS, COMMON_MODAL_SELECTORS } from '../../shared/selectors';

export interface DeleteResult extends XHSResponse<null> {
  readonly noteId?: string;
  readonly title?: string;
  readonly deletedAt: number;
}

export interface DeleteOptions {
  noteId?: string;
  lastPublished?: boolean;
  browserPath?: string;
}

/**
 * CSS selectors for delete operations - updated for current XiaoHongShu interface
 */
const DELETE_SELECTORS = {
  NOTE_ITEM: [
    'div.note',
    '.note-item',
    '[class*="note"]',
    '[data-impression]',
    '.creator-note-item',
    '.note-card',
    '.content-item'
  ],
  DELETE_BUTTON: [
    '.control.data-del',
    'span.control.data-del',
    ...COMMON_BUTTON_SELECTORS.DELETE
  ],
  CONFIRM_BUTTON: COMMON_BUTTON_SELECTORS.CONFIRM,
  CANCEL_BUTTON: COMMON_BUTTON_SELECTORS.CANCEL,
  MORE_OPTIONS: COMMON_BUTTON_SELECTORS.MORE_OPTIONS,
  DROPDOWN_MENU: COMMON_MODAL_SELECTORS.DROPDOWN_MENU,
  MODAL_CONFIRM: COMMON_MODAL_SELECTORS.CONFIRM,
  MODAL_CANCEL: COMMON_MODAL_SELECTORS.CANCEL,
} as const;

export class DeleteService extends BaseService {
  constructor(config: Config, browserManager?: BrowserManager) {
    super(config, browserManager);
  }

  /**
   * Delete a specific note by ID
   * @param noteId - The ID of the note to delete
   * @param browserPath - Optional custom browser path
   * @returns Promise<DeleteResult> - Delete operation result
   */
  async deleteNote(noteId: string, browserPath?: string): Promise<DeleteResult> {
    this.validateDeleteParams(noteId);

    const page = await this.getBrowserManager().createPage(true, browserPath, true);

    try {
      // Navigate to creator center note manager
      await navigateToCreatorCenter(page);
      await verifyCreatorAuth(page, this.getConfig().xhs.loginOkSelector);

      // Find and delete the specific note
      const result = await this.findAndDeleteNote(page, noteId);

      return {
        success: true,
        data: null,
        noteId: result.noteId,
        title: result.title,
        deletedAt: Date.now(),
        message: `Successfully deleted note "${result.title}" (ID: ${result.noteId})`,
        operation: 'deleteNote',
      } as unknown as DeleteResult;
    } catch (error) {
      logger.error(`Failed to delete note ${noteId}: ${error}`);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        message: `Failed to delete note: ${error instanceof Error ? error.message : String(error)}`,
        deletedAt: Date.now(),
        operation: 'deleteNote',
      } as unknown as DeleteResult;
    } finally {
      await page.close();
    }
  }

  /**
   * Delete the last published note
   * @param browserPath - Optional custom browser path
   * @returns Promise<DeleteResult> - Delete operation result
   */
  async deleteLastPublishedNote(browserPath?: string): Promise<DeleteResult> {
    const page = await this.getBrowserManager().createPage(true, browserPath, true);

    try {
      // Navigate to creator center note manager
      await navigateToCreatorCenter(page);
      await verifyCreatorAuth(page, this.getConfig().xhs.loginOkSelector);

      // Find and delete the last published note
      const result = await this.findAndDeleteLastNote(page);

      return {
        success: true,
        data: null,
        noteId: result.noteId,
        title: result.title,
        deletedAt: Date.now(),
        message: `Successfully deleted last published note "${result.title}" (ID: ${result.noteId})`,
        operation: 'deleteLastPublishedNote',
      } as unknown as DeleteResult;
    } catch (error) {
      logger.error(`Failed to delete last published note: ${error}`);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        message: `Failed to delete last published note: ${error instanceof Error ? error.message : String(error)}`,
        deletedAt: Date.now(),
        operation: 'deleteLastPublishedNote',
      } as unknown as DeleteResult;
    } finally {
      await page.close();
    }
  }

  /**
   * Validate delete parameters
   */
  private validateDeleteParams(noteId: string): void {
    if (!noteId || noteId.trim().length === 0) {
      throw new DeleteError('Note ID is required', { noteId });
    }
  }

  /**
   * Find and delete a specific note by ID
   */
  private async findAndDeleteNote(page: Page, noteId: string): Promise<{ noteId: string; title: string }> {
    try {
      // Step 1: Locate the note and try to find a direct delete button or more-options button
      const result = await page.evaluate(
        (selectors: typeof DELETE_SELECTORS, targetNoteId: string) => {
          let noteElements: Element[] = [];
          for (const selector of selectors.NOTE_ITEM) {
            const elements = Array.from(document.querySelectorAll(selector));
            if (elements.length > 0) {
              noteElements = elements;
              break;
            }
          }

          if (noteElements.length === 0) {
            return { noteId: targetNoteId, title: '', found: false, error: 'No note elements found on page' };
          }

          for (const noteElement of noteElements) {
            const impressionData = noteElement.getAttribute('data-impression');
            let currentNoteId = '';

            if (impressionData) {
              try {
                const parsed = JSON.parse(impressionData);
                currentNoteId = parsed?.noteTarget?.value?.noteId || '';
              } catch {
                // Ignore parsing errors
              }
            }

            if (!currentNoteId) {
              const linkElement = noteElement.querySelector('a[href*="/explore/"], a[href*="/note/"]');
              if (linkElement) {
                const href = linkElement.getAttribute('href') || '';
                const match = href.match(/\/explore\/([a-zA-Z0-9]+)/);
                if (match) {
                  currentNoteId = match[1];
                }
              }
            }

            if (currentNoteId === targetNoteId) {
              const titleElement = noteElement.querySelector('[class*="title"], [class*="name"]');
              const title = titleElement?.textContent?.trim() || 'Unknown';

              // Try to find a direct delete button first
              for (const selector of selectors.DELETE_BUTTON) {
                const deleteButton = noteElement.querySelector(selector);
                if (deleteButton) {
                  (deleteButton as HTMLElement).click();
                  return { noteId: currentNoteId, title, found: true, needsDropdown: false };
                }
              }

              // No direct delete button — check for a more-options button
              for (const selector of selectors.MORE_OPTIONS) {
                const moreButton = noteElement.querySelector(selector);
                if (moreButton) {
                  (moreButton as HTMLElement).click();
                  return { noteId: currentNoteId, title, found: true, needsDropdown: true };
                }
              }

              return { noteId: currentNoteId, title, found: false, error: 'Delete button not found' };
            }
          }

          return { noteId: targetNoteId, title: '', found: false, error: 'Note not found' };
        },
        DELETE_SELECTORS,
        noteId
      );

      if (!result.found) {
        throw new DeleteError(result.error || 'Note not found', { noteId });
      }

      // Step 2: If we clicked "more options", wait for dropdown then click delete in it
      if (result.needsDropdown) {
        await sleep(1000);
        let clicked = false;
        for (const selector of DELETE_SELECTORS.DROPDOWN_MENU) {
          const dropdown = await page.$(selector);
          if (dropdown) {
            for (const deleteSelector of DELETE_SELECTORS.DELETE_BUTTON) {
              const deleteBtn = await dropdown.$(deleteSelector);
              if (deleteBtn) {
                await deleteBtn.click();
                clicked = true;
                break;
              }
            }
            if (clicked) break;
          }
        }
        if (!clicked) {
          throw new DeleteError('Delete button not found in dropdown menu', { noteId });
        }
      }

      await sleep(1000);
      await this.handleConfirmationDialog(page);

      return { noteId: result.noteId, title: result.title };
    } catch (error) {
      throw new DeleteError(
        'Failed to find and delete note',
        { noteId },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Find and delete the last published note
   */
  private async findAndDeleteLastNote(page: Page): Promise<{ noteId: string; title: string }> {
    try {
      const result = await page.evaluate((selectors: typeof DELETE_SELECTORS) => {

        // Try each note item selector
        let noteElements: Element[] = [];
        for (const selector of selectors.NOTE_ITEM) {
          const elements = Array.from(document.querySelectorAll(selector));
          if (elements.length > 0) {
            noteElements = elements;
            break;
          }
        }

        if (noteElements.length === 0) {
          return { noteId: '', title: '', found: false, error: 'No notes found' };
        }

        // Get the first note (most recent)
        const firstNote = noteElements[0];

        // Extract note ID
        let noteId = '';
        const impressionData = firstNote.getAttribute('data-impression');

        if (impressionData) {
          try {
            const parsed = JSON.parse(impressionData);
            noteId = parsed?.noteTarget?.value?.noteId || '';
          } catch (e) {
            // Ignore parsing errors
          }
        }

        // Also try to find note ID in link
        if (!noteId) {
          const linkElement = firstNote.querySelector('a[href*="/explore/"], a[href*="/note/"]');
          if (linkElement) {
            const href = linkElement.getAttribute('href') || '';
            const match = href.match(/\/explore\/([a-zA-Z0-9]+)/);
            if (match) {
              noteId = match[1];
            }
          }
        }

        // Extract title
        const titleElement = firstNote.querySelector('[class*="title"], [class*="name"]');
        const title = titleElement?.textContent?.trim() || 'Unknown';

        // Try to find a direct delete button first
        for (const selector of selectors.DELETE_BUTTON) {
          const deleteButton = firstNote.querySelector(selector);
          if (deleteButton) {
            (deleteButton as HTMLElement).click();
            return { noteId, title, found: true, needsDropdown: false };
          }
        }

        // No direct delete button — check for a more-options button
        for (const selector of selectors.MORE_OPTIONS) {
          const moreButton = firstNote.querySelector(selector);
          if (moreButton) {
            (moreButton as HTMLElement).click();
            return { noteId, title, found: true, needsDropdown: true };
          }
        }

        return { noteId, title, found: false, error: 'Delete button not found' };
      }, DELETE_SELECTORS);

      if (!result.found) {
        throw new DeleteError(result.error || 'Failed to find delete button', {});
      }

      // If we clicked "more options", wait for dropdown then click delete in it
      if (result.needsDropdown) {
        await sleep(1000);
        let clicked = false;
        for (const selector of DELETE_SELECTORS.DROPDOWN_MENU) {
          const dropdown = await page.$(selector);
          if (dropdown) {
            for (const deleteSelector of DELETE_SELECTORS.DELETE_BUTTON) {
              const deleteBtn = await dropdown.$(deleteSelector);
              if (deleteBtn) {
                await deleteBtn.click();
                clicked = true;
                break;
              }
            }
            if (clicked) break;
          }
        }
        if (!clicked) {
          throw new DeleteError('Delete button not found in dropdown menu', {});
        }
      }

      // Wait for confirmation dialog if it appears
      await sleep(1000);

      // Handle confirmation dialog
      await this.handleConfirmationDialog(page);

      return { noteId: result.noteId, title: result.title };
    } catch (error) {
      throw new DeleteError(
        'Failed to find and delete last note',
        {},
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Handle confirmation dialog for delete operation
   */
  private async handleConfirmationDialog(page: Page): Promise<void> {
    try {
      // Wait for confirmation dialog to appear
      await sleep(2000);

      // Look for confirmation buttons using all possible selectors
      let confirmButton: import('puppeteer').ElementHandle<Element> | null = null;

      // Try each confirm button selector
      for (const selector of DELETE_SELECTORS.CONFIRM_BUTTON) {
        confirmButton = await page.$(selector);
        if (confirmButton) {
          logger.info(`Found confirm button with selector: ${selector}`);
          break;
        }
      }

      // If not found, try modal confirm selectors
      if (!confirmButton) {
        for (const selector of DELETE_SELECTORS.MODAL_CONFIRM) {
          confirmButton = await page.$(selector);
          if (confirmButton) {
            logger.info(`Found modal confirm button with selector: ${selector}`);
            break;
          }
        }
      }

      if (confirmButton) {
        logger.info('Clicking confirmation button');
        await confirmButton.click();
        await sleep(2000);
      } else {
        // If no confirmation dialog, the delete might have been immediate
        logger.info('No confirmation dialog found, delete might be immediate');
      }
    } catch (error) {
      logger.warn(`Failed to handle confirmation dialog: ${error}`);
      // Continue anyway as the delete might still work
    }
  }
}
