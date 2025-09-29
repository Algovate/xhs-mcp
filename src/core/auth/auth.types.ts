/**
 * Authentication-related types for XHS MCP Server
 */

import { LoginResult, StatusResult } from '../../shared/types';

export interface AuthServiceConfig {
  config: any; // Will be properly typed when we import Config
}

export interface LoginOptions {
  browserPath?: string;
  timeout?: number;
}

export interface StatusCheckOptions {
  browserPath?: string;
  quick?: boolean;
}

export type AuthStatus = 'logged_in' | 'logged_out' | 'unknown';
export type AuthAction = 'none' | 'logged_in' | 'logged_out' | 'failed';
