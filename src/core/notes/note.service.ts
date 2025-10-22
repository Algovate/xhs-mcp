/**
 * Note service for XHS MCP Server
 * Handles user notes/feeds operations
 */

import type { Config, XHSResponse } from '../../shared/types';
import { BaseService } from '../../shared/base.service';
import { logger } from '../../shared/logger';
import { sleep } from '../../shared/utils';
import { ProfileError, NoteParsingError, NotLoggedInError } from '../../shared/errors';

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
  readonly notes: UserNote[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string;
}

export interface NoteExtractionData {
  id: string;
  title: string;
  content: string;
  images: string[];
  publishTime: number;
  updateTime: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
  tags: string[];
  url: string;
  visibility: 'public' | 'private' | 'friends' | 'unknown';
  visibilityText?: string;
}

/**
 * Constants for note extraction
 */
const NOTE_SELECTORS = {
  // Creator center specific selectors
  PROFILE_LINK: 'a[href*="/user/profile/"]',
  NOTE_ELEMENTS: 'div.note',
  TITLE_ELEMENTS: '[class*="raw"], [class*="title"], [class*="name"]',
  IMAGE_ELEMENTS: 'img[class*="media"], img[class*="cover"], img[class*="thumbnail"]',
  STAT_ELEMENTS: '[class*="count"], [class*="stat"], [class*="number"]',
  TAG_ELEMENTS: '[class*="tag"], [class*="label"]',
  NOTE_LINK: 'a[href*="/explore/"], a[href*="/note/"]',
  VISIBILITY_INDICATORS: '[class*="private"], [class*="visibility"], [class*="lock"], [class*="eye"], [class*="public"], [class*="friends"], [class*="status"]',
  PUBLISH_TIME: '[class*="time"], [class*="date"], [class*="publish-time"]',
  NOTE_ACTIONS: '[class*="action"], [class*="menu"], [class*="button"]'
} as const;

const PROFILE_INDICATORS = ['我', 'profile', '用户'] as const;

export class NoteService extends BaseService {
  constructor(config: Config) {
    super(config);
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
        notes: limitedNotes,
        total: notesData.length,
        hasMore: notesData.length > limit,
        nextCursor: this.getNextCursor(limitedNotes),
        operation: 'getUserNotes'
      };

    } catch (error) {
      logger.error(`Failed to get user notes: ${error}`);
      return {
        success: false,
        data: [],
        notes: [],
        total: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : String(error),
        operation: 'getUserNotes'
      };
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
      throw new NoteParsingError('Failed to navigate to creator center', 
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
      const creatorElements = await page.$$('[class*="user"], [class*="profile"], [class*="avatar"]');
      
      if (loginElements.length === 0 && creatorElements.length === 0) {
        // Check if we're on a login page
        const currentUrl = page.url();
        if (currentUrl.includes('login') || currentUrl.includes('signin')) {
          throw new NotLoggedInError('User not logged in', { 
            operation: 'getUserNotes',
            url: currentUrl 
          });
        }
        
        // For creator center, check if we can see note management elements
        const noteElements = await page.$$('div.note');
        if (noteElements.length === 0) {
          throw new NotLoggedInError('User not logged in or no notes found', { 
            operation: 'getUserNotes',
            url: currentUrl 
          });
        }
      }
    } catch (error) {
      if (error instanceof NotLoggedInError) {
        throw error;
      }
      throw new NoteParsingError('Failed to verify authentication', 
        { operation: 'verifyAuth' }, 
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Find current user's profile URL
   */
  private async findUserProfileUrl(page: any): Promise<string> {
    try {
      const profileUrl = await (page as any).evaluate((selectors: typeof NOTE_SELECTORS, indicators: readonly string[]) => {
        const userLinks = Array.from((globalThis as any).document.querySelectorAll(selectors.PROFILE_LINK));
        const currentUserLink = userLinks.find((link: any) => {
            const text = link.textContent?.trim();
          return text && indicators.some(indicator => 
            text === indicator || text.includes(indicator)
          );
          });
          return currentUserLink ? (currentUserLink as HTMLAnchorElement).href : null;
      }, NOTE_SELECTORS, PROFILE_INDICATORS);

      if (!profileUrl) {
        throw new ProfileError('Could not find user profile URL', { 
          operation: 'findProfileUrl',
          selectors: NOTE_SELECTORS.PROFILE_LINK
        });
      }

      return profileUrl;
    } catch (error) {
      if (error instanceof ProfileError) {
        throw error;
      }
      throw new ProfileError('Failed to find user profile URL', 
        { operation: 'findProfileUrl' }, 
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Navigate to user profile page
   */
  private async navigateToProfilePage(page: any, profileUrl: string): Promise<void> {
    try {
        await this.getBrowserManager().navigateWithRetry(page, profileUrl);
        await sleep(2000); // Wait for profile page to load
    } catch (error) {
      throw new ProfileError('Failed to navigate to profile page', 
        { operation: 'navigateToProfile', profileUrl }, 
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Extract notes from the current page
   */
  private async extractNotesFromPage(page: any): Promise<NoteExtractionData[]> {
    try {
      const notesData = await (page as any).evaluate((selectors: typeof NOTE_SELECTORS) => {
          const notes: any[] = [];

        // Try multiple selectors to find note elements
        const possibleSelectors = [
          selectors.NOTE_ELEMENTS,
          '[class*="note-item"]',
          '[class*="noteCard"]',
          '[class*="note-card"]',
          '[class*="feed-item"]',
          '[class*="feedItem"]',
          '[class*="post-item"]',
          '[class*="postItem"]',
          'article',
          '[data-testid*="note"]',
          '[data-testid*="feed"]'
        ];
        
        let noteElements: any[] = [];
        for (const selector of possibleSelectors) {
          const elements = Array.from(document.querySelectorAll(selector));
          if (elements.length > 0) {
            noteElements = elements;
            break;
          }
        }

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
                url: ''
              };

            // Extract note ID and URL - try multiple selectors
            const linkSelectors = [
              selectors.NOTE_LINK,
              'a[href*="/explore/"]',
              'a[href*="/note/"]',
              'a[href*="/post/"]',
              'a[href*="/detail/"]'
            ];
            
            let linkElement = null;
            for (const linkSelector of linkSelectors) {
              linkElement = element.querySelector(linkSelector);
              if (linkElement) {
                break;
              }
            }
            
            if (linkElement) {
              const href = linkElement.href;
                const idMatch = href.match(/\/explore\/([a-f0-9]+)/);
                if (idMatch) {
                  note.id = idMatch[1];
                  note.url = href;
                }
              }

              // Extract title/content
            const titleElement = element.querySelector(selectors.TITLE_ELEMENTS);
              if (titleElement) {
              const title = titleElement.textContent?.trim() ?? '';
              note.title = title;
              note.content = title;
              }

              // Extract images
            const imageElements = element.querySelectorAll(selectors.IMAGE_ELEMENTS);
            imageElements.forEach((img: any) => {
              const src = img.src;
              if (src && !src.includes('avatar') && !src.includes('icon')) {
                note.images.push(src);
              }
            });

            // Extract stats
            const statElements = element.querySelectorAll(selectors.STAT_ELEMENTS);
            statElements.forEach((stat: any) => {
              const text = stat.textContent?.trim() ?? '';
                const number = parseInt(text.replace(/[^\d]/g, '')) || 0;

                if (text.includes('赞') || text.includes('like')) {
                  note.likeCount = number;
                } else if (text.includes('评论') || text.includes('comment')) {
                  note.commentCount = number;
                } else if (text.includes('分享') || text.includes('share')) {
                  note.shareCount = number;
                } else if (text.includes('收藏') || text.includes('collect')) {
                  note.collectCount = number;
                }
              });

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
      throw new NoteParsingError('Failed to extract notes from page', 
        { operation: 'extractNotes' }, 
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
              visibilityText: ''
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

            // Extract images
            const imageElements = element.querySelectorAll(selectors.IMAGE_ELEMENTS);
            imageElements.forEach((img: any) => {
              const src = img.src;
              if (src && !src.includes('avatar') && !src.includes('icon')) {
                note.images.push(src);
              }
            });

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
                const dateMatch = timeText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/);
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
      throw new NoteParsingError('Failed to extract notes from creator center', 
        { operation: 'extractNotesFromCreatorCenter' }, 
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Extract note data from a DOM element (browser context)
   */
  private extractNoteFromElementInBrowser(element: any, selectors: typeof NOTE_SELECTORS): any {
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
      url: ''
    };

    // Debug: Log element info
    console.log('Extracting from element:', {
      tagName: element.tagName,
      className: element.className,
      id: element.id,
      innerHTML: element.innerHTML?.substring(0, 200)
    });

    // Extract note ID and URL - try multiple selectors
    const linkSelectors = [
      selectors.NOTE_LINK,
      'a[href*="/explore/"]',
      'a[href*="/note/"]',
      'a[href*="/post/"]',
      'a[href*="/detail/"]'
    ];
    
    let linkElement = null;
    for (const linkSelector of linkSelectors) {
      linkElement = element.querySelector(linkSelector);
      if (linkElement) {
        console.log(`Found link with selector "${linkSelector}":`, linkElement.href);
        break;
      }
    }
    
    if (linkElement) {
      const href = linkElement.href;
      console.log('Link href:', href);
      const idMatch = href.match(/\/explore\/([a-f0-9]+)/);
      if (idMatch) {
        note.id = idMatch[1];
        note.url = href;
        console.log('Extracted ID:', note.id);
      } else {
        console.log('No ID match found in href:', href);
      }
    } else {
      console.log('No link element found');
    }

    // Extract title/content
    const titleElement = element.querySelector(selectors.TITLE_ELEMENTS);
    if (titleElement) {
      const title = titleElement.textContent?.trim() ?? '';
      note.title = title;
      note.content = title; // For now, use title as content
    }

    // Extract images
    const imageElements = element.querySelectorAll(selectors.IMAGE_ELEMENTS);
    imageElements.forEach((img: any) => {
      const src = img.src;
      if (src && !src.includes('avatar') && !src.includes('icon')) {
        note.images.push(src);
      }
    });

    // Extract stats
    this.extractNoteStatsInBrowser(element, selectors, note);

    // Extract tags
    this.extractNoteTagsInBrowser(element, selectors, note);

    return note;
  }

  /**
   * Extract statistics from note element (browser context)
   */
  private extractNoteStatsInBrowser(element: any, selectors: typeof NOTE_SELECTORS, note: any): void {
    const statElements = element.querySelectorAll(selectors.STAT_ELEMENTS);
    statElements.forEach((stat: any) => {
      const text = stat.textContent?.trim() ?? '';
      const number = parseInt(text.replace(/[^\d]/g, '')) || 0;

      if (text.includes('赞') || text.includes('like')) {
        note.likeCount = number;
      } else if (text.includes('评论') || text.includes('comment')) {
        note.commentCount = number;
      } else if (text.includes('分享') || text.includes('share')) {
        note.shareCount = number;
      } else if (text.includes('收藏') || text.includes('collect')) {
        note.collectCount = number;
      }
    });
  }

  /**
   * Extract tags from note element (browser context)
   */
  private extractNoteTagsInBrowser(element: any, selectors: typeof NOTE_SELECTORS, note: any): void {
    const tagElements = element.querySelectorAll(selectors.TAG_ELEMENTS);
    tagElements.forEach((tag: any) => {
      const tagText = tag.textContent?.trim();
      if (tagText?.startsWith('#')) {
        note.tags.push(tagText);
      }
    });
  }

  /**
   * Extract note data from a DOM element
   */
  private extractNoteFromElement(element: Element, selectors: typeof NOTE_SELECTORS): NoteExtractionData {
    const publishTime = Date.now();
    const note: NoteExtractionData = {
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
      visibilityText: ''
    };

    // Extract note ID and URL
    const linkElement = element.querySelector(selectors.NOTE_LINK);
    if (linkElement) {
      const href = (linkElement as HTMLAnchorElement).href;
      const idMatch = href.match(/\/explore\/([a-f0-9]+)/);
      if (idMatch) {
        note.id = idMatch[1];
        note.url = href;
      }
    }

    // Extract title/content
    const titleElement = element.querySelector(selectors.TITLE_ELEMENTS);
    if (titleElement) {
      const title = titleElement.textContent?.trim() ?? '';
      note.title = title;
      note.content = title; // For now, use title as content
    }

    // Extract images
    const imageElements = element.querySelectorAll(selectors.IMAGE_ELEMENTS);
    imageElements.forEach(img => {
      const src = (img as HTMLImageElement).src;
      if (src && !src.includes('avatar') && !src.includes('icon')) {
        note.images.push(src);
      }
    });

    // Extract stats
    this.extractNoteStats(element, selectors, note);

    // Extract tags
    this.extractNoteTags(element, selectors, note);

    return note;
  }

  /**
   * Extract statistics from note element
   */
  private extractNoteStats(element: Element, selectors: typeof NOTE_SELECTORS, note: NoteExtractionData): void {
    const statElements = element.querySelectorAll(selectors.STAT_ELEMENTS);
    statElements.forEach(stat => {
      const text = stat.textContent?.trim() ?? '';
      const number = parseInt(text.replace(/[^\d]/g, '')) || 0;

      if (text.includes('赞') || text.includes('like')) {
        note.likeCount = number;
      } else if (text.includes('评论') || text.includes('comment')) {
        note.commentCount = number;
      } else if (text.includes('分享') || text.includes('share')) {
        note.shareCount = number;
      } else if (text.includes('收藏') || text.includes('collect')) {
        note.collectCount = number;
      }
    });
  }

  /**
   * Extract tags from note element
   */
  private extractNoteTags(element: Element, selectors: typeof NOTE_SELECTORS, note: NoteExtractionData): void {
    const tagElements = element.querySelectorAll(selectors.TAG_ELEMENTS);
    tagElements.forEach(tag => {
      const tagText = tag.textContent?.trim();
      if (tagText?.startsWith('#')) {
        note.tags.push(tagText);
      }
    });
  }

  /**
   * Limit notes array to specified count
   */
  private limitNotes(notes: NoteExtractionData[], limit: number): UserNote[] {
    return notes.slice(0, limit).map(note => ({
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
      visibilityText: note.visibilityText
    }));
  }

  /**
   * Get next cursor for pagination
   */
  private getNextCursor(notes: UserNote[]): string | undefined {
    return notes.length > 0 ? notes[notes.length - 1].id : undefined;
  }
}
