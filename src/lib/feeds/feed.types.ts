/**
 * Feed-related types for XHS MCP Server
 */

import { FeedItem, FeedListResult, SearchResult, FeedDetailResult, CommentResult } from '../shared/types';

export interface FeedServiceConfig {
  config: any; // Will be properly typed when we import Config
}

export interface FeedListOptions {
  browserPath?: string;
}

export interface SearchOptions {
  keyword: string;
  browserPath?: string;
}

export interface FeedDetailOptions {
  feedId: string;
  xsecToken: string;
  browserPath?: string;
}

export interface CommentOptions {
  feedId: string;
  xsecToken: string;
  note: string;
  browserPath?: string;
}

export type FeedSource = 'home_page' | 'search' | 'detail';
