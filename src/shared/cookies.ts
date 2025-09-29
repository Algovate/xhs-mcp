/**
 * Cookie management for XHS MCP Server
 */

import { Cookie, CookiesInfo } from './types';
import { XHSError } from './errors';
import { getConfig } from './config';
import { readFileSync, writeFileSync, existsSync, unlinkSync, statSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { logger } from './logger';

export function getCookiesFilePath(): string {
  return getConfig().paths.cookiesFile;
}

export function loadCookies(): Cookie[] | null {
  const path = getCookiesFilePath();

  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const cookies = JSON.parse(content) as Cookie[];
    return cookies;
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.error(`Invalid JSON in cookies file ${path}: ${error.message}`);
    } else {
      logger.error(`Failed to read cookies from ${path}: ${error}`);
    }
    return null;
  }
}

export function saveCookies(cookies: Cookie[]): void {
  if (!cookies || cookies.length === 0) {
    return;
  }

  const path = getCookiesFilePath();

  try {
    // Ensure parent directory exists
    const dir = dirname(path);
    mkdirSync(dir, { recursive: true });

    // Save cookies with pretty formatting
    const content = JSON.stringify(cookies, null, 2);
    writeFileSync(path, content, 'utf-8');
  } catch (error) {
    logger.error(`Failed to save cookies to ${path}: ${error}`);
    throw new XHSError(`Failed to save cookies: ${error}`, 'CookieSaveError', {}, error as Error);
  }
}

export function deleteCookiesFile(): boolean {
  const path = getCookiesFilePath();

  if (!existsSync(path)) {
    return true;
  }

  try {
    unlinkSync(path);
    return true;
  } catch (error) {
    logger.error(`Failed to delete cookies file ${path}: ${error}`);
    return false;
  }
}

export function getCookiesInfo(): CookiesInfo {
  const path = getCookiesFilePath();
  const cookies = loadCookies();

  let lastModified: number | undefined;
  if (existsSync(path)) {
    const stats = statSync(path);
    lastModified = stats.mtime.getTime();
  }

  return {
    filePath: path,
    fileExists: existsSync(path),
    cookieCount: cookies ? cookies.length : 0,
    lastModified,
  };
}
