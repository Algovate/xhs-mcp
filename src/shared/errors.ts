/**
 * Error classes for XHS MCP Server
 */

import { XHSResponse, XHSErrorContext } from './types';

export class XHSError extends Error {
  public readonly errorCode: string;
  public readonly context: XHSErrorContext;
  public readonly originalError?: Error;

  constructor(
    message: string,
    errorCode?: string,
    context?: XHSErrorContext,
    originalError?: Error
  ) {
    super(message);
    this.name = 'XHSError';
    this.errorCode = errorCode ?? this.constructor.name;
    this.context = context ?? {};
    this.originalError = originalError;
  }

  toDict(): XHSResponse {
    const result: XHSResponse = {
      success: false,
      error: this.errorCode,
      message: this.message,
      context: this.originalError 
        ? { ...this.context, originalError: this.originalError.message }
        : this.context,
    };
    return result;
  }
}

export class AuthenticationError extends XHSError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, 'AuthenticationError', context, originalError);
  }
}

export class LoginTimeoutError extends AuthenticationError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, context, originalError);
  }
}

export class LoginFailedError extends AuthenticationError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, context, originalError);
  }
}

export class NotLoggedInError extends AuthenticationError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, context, originalError);
  }
}

export class BrowserError extends XHSError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, 'BrowserError', context, originalError);
  }
}

export class BrowserLaunchError extends BrowserError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, context, originalError);
  }
}

export class BrowserNavigationError extends BrowserError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, context, originalError);
  }
}

export class FeedError extends XHSError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, 'FeedError', context, originalError);
  }
}

export class FeedNotFoundError extends FeedError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, context, originalError);
  }
}

export class FeedParsingError extends FeedError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, context, originalError);
  }
}

export class PublishError extends XHSError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, 'PublishError', context, originalError);
  }
}

export class InvalidImageError extends PublishError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, context, originalError);
  }
}

export class PublishFailedError extends PublishError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, context, originalError);
  }
}

export class NoteError extends XHSError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, 'NoteError', context, originalError);
  }
}

export class ProfileError extends NoteError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, context, originalError);
  }
}

export class NoteParsingError extends NoteError {
  constructor(message: string, context?: XHSErrorContext, originalError?: Error) {
    super(message, context, originalError);
  }
}
