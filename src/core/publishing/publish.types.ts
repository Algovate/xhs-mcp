/**
 * Publishing-related types for XHS MCP Server
 */

import { PublishResult } from '../../shared/types';

export interface PublishServiceConfig {
  config: any; // Will be properly typed when we import Config
}

export interface PublishOptions {
  title: string;
  note: string;
  imagePaths: string[];
  tags?: string;
  browserPath?: string;
}

export interface ImageValidationResult {
  valid: boolean;
  resolvedPath: string;
  originalPath: string;
  error?: string;
}

export interface UploadTabInfo {
  text: string;
  selector: string;
}

export interface VideoPublishOptions {
  title: string;
  content: string;
  videoPath: string;
  tags?: string;
  browserPath?: string;
}

export interface VideoValidationResult {
  valid: boolean;
  resolvedPath: string;
  originalPath: string;
  error?: string;
}
