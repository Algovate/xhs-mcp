/**
 * Delete service for XHS MCP Server
 * Handles note deletion operations
 */

import type { Config, XHSResponse } from '../../shared/types';
import { BaseService } from '../../shared/base.service';
import { logger } from '../../shared/logger';
import { sleep } from '../../shared/utils';
import { DeleteError, NotLoggedInError } from '../../shared/errors';
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
  constructor(config: Config) {
    super(config);
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
      await this.navigateToCreatorCenter(page);
      await this.verifyUserAuthentication(page);

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
      await this.navigateToCreatorCenter(page);
      await this.verifyUserAuthentication(page);

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
   * Navigate to creator center note manager
   */
  private async navigateToCreatorCenter(page: Page): Promise<void> {
    try {
      const creatorCenterUrl = 'https://creator.xiaohongshu.com/new/note-manager?source=official';
      await this.getBrowserManager().navigateWithRetry(page, creatorCenterUrl);
      await sleep(5000); // Wait longer for page to load completely

      // Debug: Log page content to understand the structure
      const pageContent = await page.evaluate(() => {
        const noteElements = document.querySelectorAll('div.note, [class*="note"], [data-impression]');
        const allButtons = document.querySelectorAll('button, [role="button"], .btn, [class*="button"]');
        const allLinks = document.querySelectorAll('a[href*="/explore/"]');

        return {
          totalNoteElements: noteElements.length,
          noteElementClasses: Array.from(noteElements).map(el => el.className),
          totalButtons: allButtons.length,
          buttonTexts: Array.from(allButtons).slice(0, 10).map(btn => btn.textContent?.trim()).filter(Boolean),
          buttonClasses: Array.from(allButtons).slice(0, 10).map(btn => btn.className),
          exploreLinks: Array.from(allLinks).map(link => link.getAttribute('href')),
          pageTitle: document.title,
          currentUrl: window.location.href
        };
      });

      logger.info(`Page loaded: ${JSON.stringify(pageContent, null, 2)}`);
    } catch (error) {
      throw new DeleteError(
        'Failed to navigate to creator center',
        { url: 'https://creator.xiaohongshu.com/new/note-manager?source=official' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Verify user is authenticated
   */
  private async verifyUserAuthentication(page: Page): Promise<void> {
    try {
      // Check for login elements on the current page
      const loginElements = await page.$$(this.getConfig().xhs.loginOkSelector);

      // Also check for creator center specific elements
      const creatorElements = await page.$$(
        '[class*="user"], [class*="profile"], [class*="avatar"]'
      );

      if (loginElements.length === 0 && creatorElements.length === 0) {
        // Check if we're on a login page
        const currentUrl = page.url();
        if (currentUrl.includes('login') || currentUrl.includes('signin')) {
          throw new NotLoggedInError('User not logged in', {
            operation: 'deleteNote',
            url: currentUrl,
          });
        }

        // For creator center, check if we can see note management elements
        const noteElements = await page.$$('div.note');
        if (noteElements.length === 0) {
          throw new NotLoggedInError('User not logged in or no notes found', {
            operation: 'deleteNote',
            url: currentUrl,
          });
        }
      }
    } catch (error) {
      if (error instanceof NotLoggedInError) {
        throw error;
      }
      throw new DeleteError(
        'Failed to verify authentication',
        { operation: 'verifyAuth' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Find and delete a specific note by ID
   */
  private async findAndDeleteNote(page: Page, noteId: string): Promise<{ noteId: string; title: string }> {
    try {
      const result = await page.evaluate(
        (selectors: typeof DELETE_SELECTORS, targetNoteId: string) => {

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
            return { noteId: targetNoteId, title: '', found: false, error: 'No note elements found on page' };
          }

          for (const noteElement of noteElements) {
            // Check if this is the note we want to delete
            const impressionData = noteElement.getAttribute('data-impression');
            let currentNoteId = '';

            if (impressionData) {
              try {
                const parsed = JSON.parse(impressionData);
                currentNoteId = parsed?.noteTarget?.value?.noteId || '';
              } catch (e) {
                // Ignore parsing errors
              }
            }

            // Also try to find note ID in other attributes or data
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
              // Found the target note, try to delete it
              const titleElement = noteElement.querySelector('[class*="title"], [class*="name"]');
              const title = titleElement?.textContent?.trim() || 'Unknown';

              // Look for delete button or more options button
              let deleteButton: Element | null = null;

              // Try each delete button selector
              for (const selector of selectors.DELETE_BUTTON) {
                deleteButton = noteElement.querySelector(selector);
                if (deleteButton) {
                  break;
                }
              }

              if (!deleteButton) {
                // Try to find more options button first
                let moreButton: Element | null = null;
                for (const selector of selectors.MORE_OPTIONS) {
                  moreButton = noteElement.querySelector(selector);
                  if (moreButton) {
                    break;
                  }
                }

                if (moreButton) {
                  (moreButton as HTMLElement).click();

                  // Wait for dropdown to appear and look for delete option
                  setTimeout(() => {
                    for (const selector of selectors.DROPDOWN_MENU) {
                      const dropdown = document.querySelector(selector);
                      if (dropdown) {
                        for (const deleteSelector of selectors.DELETE_BUTTON) {
                          deleteButton = dropdown.querySelector(deleteSelector);
                          if (deleteButton) {
                            break;
                          }
                        }
                        if (deleteButton) break;
                      }
                    }
                  }, 1000);
                }
              }

              if (deleteButton) {
                (deleteButton as HTMLElement).click();
                return { noteId: currentNoteId, title, found: true };
              } else {
                return { noteId: currentNoteId, title, found: false, error: 'Delete button not found' };
              }
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

      // Wait for confirmation dialog if it appears
      await sleep(1000);

      // Handle confirmation dialog
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

        // Look for delete button or more options button
        let deleteButton: Element | null = null;

        // Try each delete button selector
        for (const selector of selectors.DELETE_BUTTON) {
          deleteButton = firstNote.querySelector(selector);
          if (deleteButton) {
            break;
          }
        }

        if (!deleteButton) {
          // Try to find more options button first
          let moreButton: Element | null = null;
          for (const selector of selectors.MORE_OPTIONS) {
            moreButton = firstNote.querySelector(selector);
            if (moreButton) {
              break;
            }
          }

          if (moreButton) {
            (moreButton as HTMLElement).click();

            // Wait for dropdown to appear and look for delete option
            setTimeout(() => {
              for (const selector of selectors.DROPDOWN_MENU) {
                const dropdown = document.querySelector(selector);
                if (dropdown) {
                  for (const deleteSelector of selectors.DELETE_BUTTON) {
                    deleteButton = dropdown.querySelector(deleteSelector);
                    if (deleteButton) {
                      break;
                    }
                  }
                  if (deleteButton) break;
                }
              }
            }, 1000);
          }
        }

        if (deleteButton) {
          (deleteButton as HTMLElement).click();
          return { noteId, title, found: true };
        } else {
          return { noteId, title, found: false, error: 'Delete button not found' };
        }
      }, DELETE_SELECTORS);

      if (!result.found) {
        throw new DeleteError(result.error || 'Failed to find delete button', {});
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
      let confirmButton = null;

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
