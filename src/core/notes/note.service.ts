/**
 * Note service for XHS MCP Server
 * Handles user notes/feeds operations
 */

import type { Config, XHSResponse } from '../../shared/types';
import { BaseService } from '../../shared/base.service';
import { logger } from '../../shared/logger';
import { sleep } from '../../shared/utils';
import { ProfileError, NoteParsingError, NotLoggedInError } from '../../shared/errors';
import { DeleteService, DeleteResult } from '../deleting/delete.service';

export interface UserNote {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly images: readonly string[];
  readonly video?: string;
  readonly publishTime: number;
  readonly updateTime: number;
  readonly likeCount: number;
  readonly commentCount: number;
  readonly shareCount: number;
  readonly collectCount: number;
  readonly tags: readonly string[];
  readonly url: string;
  readonly visibility: 'public' | 'private' | 'friends' | 'unknown';
  readonly visibilityText?: string;
}

export interface UserNotesResult extends XHSResponse<UserNote[]> {
  readonly total: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string;
}

export interface NoteExtractionData {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly images: readonly string[];
  readonly publishTime: number;
  readonly updateTime: number;
  readonly likeCount: number;
  readonly commentCount: number;
  readonly shareCount: number;
  readonly collectCount: number;
  readonly tags: readonly string[];
  readonly url: string;
  readonly visibility: 'public' | 'private' | 'friends' | 'unknown';
  readonly visibilityText?: string;
}

/**
 * CSS selectors for note extraction from Creator Center
 */
const NOTE_SELECTORS = {
  NOTE_ELEMENTS: 'div.note',
  TITLE_ELEMENTS: '[class*="raw"], [class*="title"], [class*="name"]',
  IMAGE_ELEMENTS: 'img[class*="media"], img[class*="cover"], img[class*="thumbnail"]',
  STAT_ELEMENTS: '[class*="count"], [class*="stat"], [class*="number"]',
  TAG_ELEMENTS: '[class*="tag"], [class*="label"]',
  NOTE_LINK: 'a[href*="/explore/"], a[href*="/note/"]',
  VISIBILITY_INDICATORS:
    '[class*="private"], [class*="visibility"], [class*="lock"], [class*="eye"], [class*="public"], [class*="friends"], [class*="status"]',
  PUBLISH_TIME: '[class*="time"], [class*="date"], [class*="publish-time"]',
} as const;

export class NoteService extends BaseService {
  private deleteService: DeleteService;

  constructor(config: Config) {
    super(config);
    this.deleteService = new DeleteService(config);
  }

  /**
   * Get current user's published notes from creator center
   * @param limit - Maximum number of notes to return (default: 20)
   * @param cursor - Pagination cursor for next page
   * @param browserPath - Optional custom browser path
   * @returns Promise<UserNotesResult> - User notes with pagination info
   */
  async getUserNotes(
    limit: number = 20,
    cursor?: string,
    browserPath?: string
  ): Promise<UserNotesResult> {
    this.validateGetUserNotesParams(limit);

    const page = await this.getBrowserManager().createPage(true, browserPath, true);

    try {
      // Navigate to creator center note manager
      await this.navigateToCreatorCenter(page);
      await this.verifyUserAuthentication(page);

      // Extract notes from creator center
      const notesData = await this.extractNotesFromCreatorCenter(page);
      const limitedNotes = this.limitNotes(notesData, limit);

      return {
        success: true,
        data: limitedNotes,
        total: notesData.length,
        hasMore: notesData.length > limit,
        nextCursor: this.getNextCursor(limitedNotes),
        operation: 'getUserNotes',
      } as unknown as UserNotesResult;
    } catch (error) {
      logger.error(`Failed to get user notes: ${error}`);
      return {
        success: false,
        data: [],
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : String(error),
        operation: 'getUserNotes',
      } as unknown as UserNotesResult;
    } finally {
      await page.close();
    }
  }

  /**
   * Validate parameters for getUserNotes method
   */
  private validateGetUserNotesParams(limit: number): void {
    if (limit <= 0) {
      throw new NoteParsingError('Limit must be greater than 0', { limit });
    }
    if (limit > 100) {
      throw new NoteParsingError('Limit cannot exceed 100', { limit });
    }
  }

  /**
   * Navigate to creator center note manager
   */
  private async navigateToCreatorCenter(page: any): Promise<void> {
    try {
      const creatorCenterUrl = 'https://creator.xiaohongshu.com/new/note-manager?source=official';
      await this.getBrowserManager().navigateWithRetry(page, creatorCenterUrl);
      await sleep(3000); // Wait for page to load completely
    } catch (error) {
      throw new NoteParsingError(
        'Failed to navigate to creator center',
        { url: 'https://creator.xiaohongshu.com/new/note-manager?source=official' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Verify user is authenticated
   */
  private async verifyUserAuthentication(page: any): Promise<void> {
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
            operation: 'getUserNotes',
            url: currentUrl,
          });
        }

        // For creator center, check if we can see note management elements
        const noteElements = await page.$$('div.note');
        if (noteElements.length === 0) {
          throw new NotLoggedInError('User not logged in or no notes found', {
            operation: 'getUserNotes',
            url: currentUrl,
          });
        }
      }
    } catch (error) {
      if (error instanceof NotLoggedInError) {
        throw error;
      }
      throw new NoteParsingError(
        'Failed to verify authentication',
        { operation: 'verifyAuth' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Extract notes from creator center page
   */
  private async extractNotesFromCreatorCenter(page: any): Promise<NoteExtractionData[]> {
    try {
      const notesData = await (page as any).evaluate((selectors: typeof NOTE_SELECTORS) => {
        const notes: any[] = [];

        // Find note elements using the creator center selector
        const noteElements = Array.from(document.querySelectorAll(selectors.NOTE_ELEMENTS));
        console.log('Found note elements:', noteElements.length);

        noteElements.forEach((element: any) => {
          try {
            // Extract note data from element
            const publishTime = Date.now();
            const note: any = {
              id: '',
              title: '',
              content: '',
              images: [],
              publishTime,
              updateTime: publishTime,
              likeCount: 0,
              commentCount: 0,
              shareCount: 0,
              collectCount: 0,
              tags: [],
              url: '',
              visibility: 'unknown',
              visibilityText: '',
            };

            // Extract note ID from data attributes or impression data
            const impressionData = element.getAttribute('data-impression');
            if (impressionData) {
              try {
                const parsed = JSON.parse(impressionData);
                const noteId = parsed?.noteTarget?.value?.noteId;
                if (noteId) {
                  note.id = noteId;
                  note.url = `https://www.xiaohongshu.com/explore/${noteId}`;
                }
              } catch (e) {
                console.log('Failed to parse impression data:', e);
              }
            }

            // Extract title/content
            const titleElement = element.querySelector(selectors.TITLE_ELEMENTS);
            if (titleElement) {
              const title = titleElement.textContent?.trim() ?? '';
              note.title = title;
              note.content = title;
            }

            // Extract images - try multiple approaches for creator center
            const imageSelectors = [
              selectors.IMAGE_ELEMENTS,
              'img', // Try all img elements
              '[class*="image"]',
              '[class*="photo"]',
              '[class*="pic"]',
              '[class*="img"]',
              '[style*="background-image"]', // Background images
              'div[class*="cover"] img',
              'div[class*="thumbnail"] img',
              'div[class*="media"] img',
            ];

            let imageElements: any[] = [];
            for (const selector of imageSelectors) {
              const elements = element.querySelectorAll(selector);
              if (elements.length > 0) {
                imageElements = Array.from(elements);
                console.log(`Found ${elements.length} images with selector: ${selector}`);
                break;
              }
            }

            imageElements.forEach((img: any) => {
              let src = '';

              // Try different ways to get image source
              if (img.src) {
                src = img.src;
              } else if (img.style && img.style.backgroundImage) {
                // Extract from background-image CSS
                const bgMatch = img.style.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (bgMatch) {
                  src = bgMatch[1];
                }
              } else if (img.getAttribute('data-src')) {
                // Lazy loaded images
                src = img.getAttribute('data-src');
              } else if (img.getAttribute('data-original')) {
                // Another lazy loading attribute
                src = img.getAttribute('data-original');
              }

              if (
                src &&
                !src.includes('avatar') &&
                !src.includes('icon') &&
                !src.includes('logo') &&
                !src.includes('placeholder') &&
                src.startsWith('http')
              ) {
                note.images.push(src);
                console.log('Added image:', src);
              }
            });

            console.log(`Note ${note.id} has ${note.images.length} images`);

            // Extract stats - look for numbers in the element
            const allText = element.textContent || '';
            const numbers = allText.match(/\d+/g) || [];

            // Try to extract stats from text content
            if (numbers.length >= 4) {
              // Assuming order: like, comment, share, collect, view
              note.likeCount = parseInt(numbers[0]) || 0;
              note.commentCount = parseInt(numbers[1]) || 0;
              note.shareCount = parseInt(numbers[2]) || 0;
              note.collectCount = parseInt(numbers[3]) || 0;
            }

            // Extract publish time
            const timeElement = element.querySelector(selectors.PUBLISH_TIME);
            if (timeElement) {
              const timeText = timeElement.textContent?.trim() || '';
              if (timeText.includes('发布于')) {
                // Parse Chinese date format
                const dateMatch = timeText.match(
                  /(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/
                );
                if (dateMatch) {
                  const [, year, month, day, hour, minute] = dateMatch;
                  const publishDate = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hour),
                    parseInt(minute)
                  );
                  note.publishTime = publishDate.getTime();
                  note.updateTime = publishDate.getTime();
                }
              }
            }

            // Extract visibility information
            const elementText = element.textContent?.toLowerCase() || '';
            if (elementText.includes('仅自己可见')) {
              note.visibility = 'private';
              note.visibilityText = '仅自己可见';
            } else if (elementText.includes('朋友可见')) {
              note.visibility = 'friends';
              note.visibilityText = '朋友可见';
            } else if (elementText.includes('公开')) {
              note.visibility = 'public';
              note.visibilityText = '公开';
            } else {
              // Default to public for notes without explicit visibility indicators
              note.visibility = 'public';
              note.visibilityText = '公开';
            }

            // Extract tags
            const tagElements = element.querySelectorAll(selectors.TAG_ELEMENTS);
            tagElements.forEach((tag: any) => {
              const tagText = tag.textContent?.trim();
              if (tagText?.startsWith('#')) {
                note.tags.push(tagText);
              }
            });

            if (note.id) {
              notes.push(note);
            }
          } catch (error) {
            console.error('Error extracting note:', error);
          }
        });

        return notes;
      }, NOTE_SELECTORS);

      return notesData;
    } catch (error) {
      throw new NoteParsingError(
        'Failed to extract notes from creator center',
        { operation: 'extractNotesFromCreatorCenter' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Limit notes array to specified count
   */
  private limitNotes(notes: NoteExtractionData[], limit: number): UserNote[] {
    return notes.slice(0, limit).map((note) => ({
      id: note.id,
      title: note.title,
      content: note.content,
      images: Object.freeze([...note.images]),
      publishTime: note.publishTime,
      updateTime: note.updateTime,
      likeCount: note.likeCount,
      commentCount: note.commentCount,
      shareCount: note.shareCount,
      collectCount: note.collectCount,
      tags: Object.freeze([...note.tags]),
      url: note.url,
      visibility: note.visibility,
      visibilityText: note.visibilityText,
    }));
  }

  /**
   * Get next cursor for pagination
   */
  private getNextCursor(notes: UserNote[]): string | undefined {
    return notes.length > 0 ? notes[notes.length - 1].id : undefined;
  }

  /**
   * Delete a specific note by ID
   * @param noteId - The ID of the note to delete
   * @param browserPath - Optional custom browser path
   * @returns Promise<DeleteResult> - Delete operation result
   */
  async deleteNote(noteId: string, browserPath?: string): Promise<DeleteResult> {
    return this.deleteService.deleteNote(noteId, browserPath);
  }

  /**
   * Delete the last published note
   * @param browserPath - Optional custom browser path
   * @returns Promise<DeleteResult> - Delete operation result
   */
  async deleteLastPublishedNote(browserPath?: string): Promise<DeleteResult> {
    return this.deleteService.deleteLastPublishedNote(browserPath);
  }
}
