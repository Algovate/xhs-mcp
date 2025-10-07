/**
 * Title validation utility for XHS MCP Server
 * Validates title width according to XiaoHongShu's display width rules
 * 
 * XHS Rules:
 * - Max width: 40 units
 * - CJK characters (Chinese/Japanese/Korean): 2 units each
 * - Other characters (English/Numbers): 1 unit each
 */

import stringWidth from 'string-width';
import { PublishError } from './errors';

export interface TitleValidationResult {
  valid: boolean;
  width: number;
  maxWidth: number;
  message?: string;
  suggestion?: string;
}

/**
 * XiaoHongShu title constraints
 */
export const XHS_TITLE_CONSTRAINTS = {
  MAX_WIDTH: 40, // Maximum display width in units
  MAX_LENGTH: 20, // Approximate max character count (for reference)
} as const;

/**
 * Validate title width according to XHS display rules
 * 
 * @param title - The title to validate
 * @returns Validation result with width information
 * 
 * @example
 * ```typescript
 * const result = validateTitleWidth('Hello世界');
 * console.log(result.width); // 10 (5 + 2*2 + 1 = 10)
 * console.log(result.valid); // true
 * ```
 */
export function validateTitleWidth(title: string): TitleValidationResult {
  if (!title) {
    return {
      valid: false,
      width: 0,
      maxWidth: XHS_TITLE_CONSTRAINTS.MAX_WIDTH,
      message: 'Title cannot be empty',
      suggestion: 'Please provide a valid title',
    };
  }

  // Calculate display width using string-width
  // This correctly handles CJK characters, emoji, and other Unicode
  const width = stringWidth(title);

  if (width > XHS_TITLE_CONSTRAINTS.MAX_WIDTH) {
    return {
      valid: false,
      width,
      maxWidth: XHS_TITLE_CONSTRAINTS.MAX_WIDTH,
      message: `Title width exceeds limit: ${width} units (max: ${XHS_TITLE_CONSTRAINTS.MAX_WIDTH} units)`,
      suggestion: `Current title is too long. CJK characters count as 2 units, English/numbers as 1 unit. Please shorten your title.`,
    };
  }

  return {
    valid: true,
    width,
    maxWidth: XHS_TITLE_CONSTRAINTS.MAX_WIDTH,
  };
}

/**
 * Validate and throw error if title width is invalid
 * 
 * @param title - The title to validate
 * @throws PublishError if title width is invalid
 * 
 * @example
 * ```typescript
 * try {
 *   assertTitleWidthValid('很长很长的标题'.repeat(10));
 * } catch (error) {
 *   console.error(error.message);
 * }
 * ```
 */
export function assertTitleWidthValid(title: string): void {
  const result = validateTitleWidth(title);
  
  if (!result.valid) {
    throw new PublishError(result.message!, {
      title,
      width: result.width,
      maxWidth: result.maxWidth,
      suggestion: result.suggestion,
      details: {
        titleLength: title.length,
        displayWidth: result.width,
        maxDisplayWidth: result.maxWidth,
        exceeded: result.width - result.maxWidth,
      },
    });
  }
}

/**
 * Get the display width of a title
 * 
 * @param title - The title to measure
 * @returns Display width in units
 * 
 * @example
 * ```typescript
 * console.log(getTitleWidth('Hello'));        // 5
 * console.log(getTitleWidth('你好'));         // 4 (2*2)
 * console.log(getTitleWidth('Hello世界'));    // 10 (5 + 2*2 + 1)
 * console.log(getTitleWidth('👋Hello'));      // 7 (2 + 5)
 * ```
 */
export function getTitleWidth(title: string): number {
  return stringWidth(title);
}

/**
 * Calculate how many characters can be added to the title
 * 
 * @param title - Current title
 * @returns Remaining width units available
 * 
 * @example
 * ```typescript
 * const remaining = getRemainingTitleWidth('Hello'); // 35
 * console.log(`You can add ${remaining} more units`);
 * ```
 */
export function getRemainingTitleWidth(title: string): number {
  const currentWidth = getTitleWidth(title);
  return Math.max(0, XHS_TITLE_CONSTRAINTS.MAX_WIDTH - currentWidth);
}

/**
 * Truncate title to fit within width limit
 * 
 * @param title - The title to truncate
 * @param maxWidth - Maximum width (default: XHS_TITLE_CONSTRAINTS.MAX_WIDTH)
 * @returns Truncated title that fits within width limit
 * 
 * @example
 * ```typescript
 * const long = '这是一个很长很长的标题'.repeat(5);
 * const truncated = truncateTitleToWidth(long);
 * console.log(getTitleWidth(truncated)); // <= 40
 * ```
 */
export function truncateTitleToWidth(
  title: string,
  maxWidth: number = XHS_TITLE_CONSTRAINTS.MAX_WIDTH
): string {
  if (getTitleWidth(title) <= maxWidth) {
    return title;
  }

  let truncated = '';
  let currentWidth = 0;

  for (const char of title) {
    const charWidth = stringWidth(char);
    
    if (currentWidth + charWidth > maxWidth) {
      break;
    }
    
    truncated += char;
    currentWidth += charWidth;
  }

  return truncated;
}

/**
 * Get human-readable width breakdown
 * Useful for debugging and user feedback
 * 
 * @param title - The title to analyze
 * @returns Width breakdown information
 */
export function getTitleWidthBreakdown(title: string): {
  title: string;
  totalWidth: number;
  totalChars: number;
  maxWidth: number;
  remaining: number;
  valid: boolean;
  breakdown: Array<{
    char: string;
    width: number;
    type: 'CJK' | 'ASCII' | 'Emoji' | 'Other';
  }>;
} {
  const totalWidth = getTitleWidth(title);
  const breakdown: Array<{ char: string; width: number; type: 'CJK' | 'ASCII' | 'Emoji' | 'Other' }> = [];

  for (const char of title) {
    const charWidth = stringWidth(char);
    let type: 'CJK' | 'ASCII' | 'Emoji' | 'Other' = 'Other';

    const code = char.charCodeAt(0);
    if (char.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/)) {
      type = 'CJK';
    } else if (code < 128) {
      type = 'ASCII';
    } else if (char.match(/[\u{1F300}-\u{1F9FF}]/u)) {
      type = 'Emoji';
    }

    breakdown.push({ char, width: charWidth, type });
  }

  return {
    title,
    totalWidth,
    totalChars: title.length,
    maxWidth: XHS_TITLE_CONSTRAINTS.MAX_WIDTH,
    remaining: getRemainingTitleWidth(title),
    valid: totalWidth <= XHS_TITLE_CONSTRAINTS.MAX_WIDTH,
    breakdown,
  };
}

