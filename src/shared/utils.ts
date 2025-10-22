/**
 * Common utility functions for XHS MCP Server
 */

/**
 * Sleep utility function
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safe error handler that logs errors without throwing
 * @param error - Error to handle
 * @param context - Additional context for the error
 * @param logger - Logger instance to use
 */
export function safeErrorHandler(
  error: unknown,
  context: string,
  logger: { error: (message: string, ...args: unknown[]) => void }
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`${context}: ${errorMessage}`);
}

/**
 * Validate required parameters
 * @param params - Object containing parameters to validate
 * @param requiredKeys - Array of required parameter keys
 * @throws Error if any required parameter is missing
 */
export function validateRequiredParams(
  params: Record<string, unknown>,
  requiredKeys: string[]
): void {
  const missingKeys = requiredKeys.filter(
    (key) => params[key] === undefined || params[key] === null || params[key] === ''
  );

  if (missingKeys.length > 0) {
    throw new Error(`Missing required parameters: ${missingKeys.join(', ')}`);
  }
}

/**
 * Type guard to check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Type guard to check if a value is an array
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Safely parse JSON string
 * @param jsonString - JSON string to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed object or fallback value
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

/**
 * Validate publish note parameters with length constraints
 * @param title - Note title
 * @param note - Note content
 * @param imagePaths - Array of image paths
 * @throws Error if any parameter violates constraints
 */
export function validatePublishNoteParams(title: string, note: string, imagePaths: string[]): void {
  // Validate title length (max 20 characters)
  if (title && title.length > 20) {
    throw new Error(`Title length cannot exceed 20 characters. Current length: ${title.length}`);
  }

  // Validate note content length (max 1000 characters)
  if (note && note.length > 1000) {
    throw new Error(
      `Note content length cannot exceed 1000 characters. Current length: ${note.length}`
    );
  }

  // Validate image count (max 18 images)
  if (imagePaths && imagePaths.length > 18) {
    throw new Error(`Maximum 18 images allowed. Current count: ${imagePaths.length}`);
  }
}

/**
 * Create a standardized response object
 * @param success - Whether the operation was successful
 * @param data - Optional data to include
 * @param message - Optional message
 * @param error - Optional error information
 * @returns Standardized response object
 */
export function createApiResponse<T = unknown>(
  success: boolean,
  data?: T,
  message?: string,
  error?: string
): { success: boolean; data?: T; message?: string; error?: string } {
  const response: { success: boolean; data?: T; message?: string; error?: string } = { success };

  if (data !== undefined) response.data = data;
  if (message !== undefined) response.message = message;
  if (error !== undefined) response.error = error;

  return response;
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds
 * @returns Promise that resolves with the function result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Create a standardized MCP tool response
 * @param data - Data to include in the response
 * @returns Standardized MCP response format
 */
export function createMcpToolResponse<T = unknown>(
  data: T
): { content: Array<{ type: string; text: string }> } {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Create a standardized MCP error response
 * @param error - Error to format
 * @returns Standardized MCP error response format
 */
export function createMcpErrorResponse(error: unknown): {
  content: Array<{ type: string; text: string }>;
} {
  const errorData =
    error instanceof Error
      ? {
          success: false,
          error: 'UnknownError',
          message: error.message,
          stack: error.stack,
        }
      : {
          success: false,
          error: 'UnknownError',
          message: String(error),
        };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(errorData, null, 2),
      },
    ],
  };
}
