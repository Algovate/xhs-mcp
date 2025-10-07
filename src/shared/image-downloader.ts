/**
 * Image downloader utility for XHS MCP Server
 * Supports downloading images from HTTP/HTTPS URLs
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import fetch from 'node-fetch';
import { InvalidImageError } from './errors';
import { logger } from './logger';

export interface DownloadResult {
  originalUrl: string;
  localPath: string;
  cached: boolean;
  fileSize: number;
}

export class ImageDownloader {
  private saveDir: string;
  private timeout: number;

  constructor(saveDir: string = './temp_images', timeout: number = 30000) {
    this.saveDir = saveDir;
    this.timeout = timeout;

    // Ensure save directory exists
    if (!existsSync(this.saveDir)) {
      mkdirSync(this.saveDir, { recursive: true });
    }
  }

  /**
   * Check if a string is a valid HTTP/HTTPS URL
   */
  static isImageUrl(path: string): boolean {
    if (!path) return false;
    const lowerPath = path.toLowerCase().trim();
    return lowerPath.startsWith('http://') || lowerPath.startsWith('https://');
  }

  /**
   * Generate a unique filename for an image URL
   */
  private generateFileName(imageUrl: string): string {
    // Use SHA256 hash of URL for uniqueness
    const hash = createHash('sha256').update(imageUrl).digest('hex');
    const shortHash = hash.substring(0, 16);
    
    // Try to extract extension from URL
    let extension = 'jpg'; // default
    try {
      const url = new URL(imageUrl);
      const pathname = url.pathname.toLowerCase();
      const match = pathname.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
      if (match) {
        extension = match[1];
      }
    } catch (e) {
      // Use default extension
    }

    return `img_${shortHash}_${Date.now()}.${extension}`;
  }

  /**
   * Validate that downloaded data is actually an image
   */
  private validateImageData(buffer: Buffer): { isValid: boolean; extension: string } {
    // Check file signatures (magic numbers)
    if (buffer.length < 12) {
      return { isValid: false, extension: '' };
    }

    // JPEG
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { isValid: true, extension: 'jpg' };
    }

    // PNG
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return { isValid: true, extension: 'png' };
    }

    // GIF
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return { isValid: true, extension: 'gif' };
    }

    // WebP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { isValid: true, extension: 'webp' };
    }

    // BMP
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
      return { isValid: true, extension: 'bmp' };
    }

    return { isValid: false, extension: '' };
  }

  /**
   * Download a single image from URL
   */
  async downloadImage(imageUrl: string): Promise<DownloadResult> {
    // Validate URL format
    if (!ImageDownloader.isImageUrl(imageUrl)) {
      throw new InvalidImageError(`Invalid image URL format: ${imageUrl}`, {
        url: imageUrl,
        suggestion: 'URL must start with http:// or https://',
      });
    }

    // Generate filename and path
    const fileName = this.generateFileName(imageUrl);
    const localPath = join(this.saveDir, fileName);

    // Check if file already exists (cache)
    if (existsSync(localPath)) {
      const stats = statSync(localPath);
      logger.debug(`Using cached image: ${localPath}`);
      return {
        originalUrl: imageUrl,
        localPath,
        cached: true,
        fileSize: stats.size,
      };
    }

    logger.debug(`Downloading image from: ${imageUrl}`);

    try {
      // Download image with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new InvalidImageError(
          `Failed to download image: HTTP ${response.status} ${response.statusText}`,
          {
            url: imageUrl,
            statusCode: response.status,
            statusText: response.statusText,
          }
        );
      }

      // Get image data
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Validate it's actually an image
      const validation = this.validateImageData(buffer);
      if (!validation.isValid) {
        throw new InvalidImageError(
          `Downloaded file is not a valid image: ${imageUrl}`,
          {
            url: imageUrl,
            suggestion: 'Make sure the URL points to an actual image file',
          }
        );
      }

      // Save to file
      writeFileSync(localPath, buffer);

      logger.debug(`Image downloaded successfully: ${localPath} (${buffer.length} bytes)`);

      return {
        originalUrl: imageUrl,
        localPath,
        cached: false,
        fileSize: buffer.length,
      };
    } catch (error) {
      if (error instanceof InvalidImageError) {
        throw error;
      }

      // Handle abort error
      if ((error as any).name === 'AbortError') {
        throw new InvalidImageError(
          `Image download timeout after ${this.timeout}ms: ${imageUrl}`,
          {
            url: imageUrl,
            timeout: this.timeout,
            suggestion: 'The image may be too large or the network is slow',
          },
          error as Error
        );
      }

      throw new InvalidImageError(
        `Failed to download image: ${imageUrl}`,
        {
          url: imageUrl,
        },
        error as Error
      );
    }
  }

  /**
   * Download multiple images from URLs
   */
  async downloadImages(imageUrls: string[]): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    const errors: Array<{ url: string; error: Error }> = [];

    for (const url of imageUrls) {
      try {
        const result = await this.downloadImage(url);
        results.push(result);
      } catch (error) {
        errors.push({ url, error: error as Error });
      }
    }

    // If any downloads failed, throw an error with details
    if (errors.length > 0) {
      const errorMessages = errors.map((e) => `${e.url}: ${e.error.message}`).join('\n');
      throw new InvalidImageError(
        `Failed to download ${errors.length} of ${imageUrls.length} images:\n${errorMessages}`,
        {
          totalCount: imageUrls.length,
          failedCount: errors.length,
          successCount: results.length,
          failedUrls: errors.map((e) => e.url),
        }
      );
    }

    return results;
  }

  /**
   * Process a list of image paths - download URLs and keep local paths as-is
   */
  async processImagePaths(imagePaths: string[]): Promise<string[]> {
    const localPaths: string[] = [];
    const urlsToDownload: string[] = [];

    // Separate URLs from local paths
    for (const path of imagePaths) {
      if (ImageDownloader.isImageUrl(path)) {
        urlsToDownload.push(path);
      } else {
        // Validate local path exists
        if (!existsSync(path)) {
          throw new InvalidImageError(`Local image file not found: ${path}`, {
            path,
            suggestion: 'Make sure the file path is correct and the file exists',
          });
        }
        localPaths.push(path);
      }
    }

    // Download URLs if any
    if (urlsToDownload.length > 0) {
      logger.debug(`Downloading ${urlsToDownload.length} images from URLs...`);
      const downloadResults = await this.downloadImages(urlsToDownload);
      const downloadedPaths = downloadResults.map((r) => r.localPath);
      localPaths.push(...downloadedPaths);

      // Log download summary
      const cachedCount = downloadResults.filter((r) => r.cached).length;
      const newCount = downloadResults.filter((r) => !r.cached).length;
      logger.debug(
        `Downloaded ${newCount} new images, used ${cachedCount} cached images`
      );
    }

    if (localPaths.length === 0) {
      throw new InvalidImageError('No valid images found', {
        providedPaths: imagePaths.length,
        suggestion: 'Provide at least one valid image URL or local file path',
      });
    }

    return localPaths;
  }

  /**
   * Get the save directory path
   */
  getSaveDir(): string {
    return this.saveDir;
  }
}

// Export a default instance
let defaultDownloader: ImageDownloader | null = null;

export function getImageDownloader(saveDir?: string): ImageDownloader {
  if (!defaultDownloader || (saveDir && defaultDownloader.getSaveDir() !== saveDir)) {
    defaultDownloader = new ImageDownloader(saveDir);
  }
  return defaultDownloader;
}

