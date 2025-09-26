---
inclusion: fileMatch
fileMatchPattern: ['src/lib/**/*.ts']
---

# Service Layer Development Patterns

## Service Architecture

This project follows a layered service architecture with clear separation of concerns.

### Service Structure

- **Base Service**: [src/lib/shared/base.service.ts](mdc:src/lib/shared/base.service.ts) - Common service functionality
- **Auth Service**: [src/lib/auth/auth.service.ts](mdc:src/lib/auth/auth.service.ts) - Authentication operations
- **Feed Service**: [src/lib/feeds/feed.service.ts](mdc:src/lib/feeds/feed.service.ts) - Feed discovery and search
- **Publish Service**: [src/lib/publishing/publish.service.ts](mdc:src/lib/publishing/publish.service.ts) - Content publishing

## Service Implementation Patterns

### Base Service Pattern
```typescript
export abstract class BaseService {
  protected config: Config;
  protected logger: Logger;
  
  constructor() {
    this.config = getConfig();
    this.logger = getLogger();
  }
  
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    // Implement retry logic with exponential backoff
  }
}
```

### Service Method Pattern
```typescript
async methodName(params: MethodParams): Promise<XHSResponse<MethodResult>> {
  try {
    // Validate input parameters
    this.validateParams(params);
    
    // Execute operation with retry logic
    const result = await this.executeWithRetry(
      () => this.performOperation(params),
      'operation_name'
    );
    
    return {
      success: true,
      data: result,
      operation: 'operation_name'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      operation: 'operation_name'
    };
  }
}
```

## Response Format

### XHSResponse Interface
```typescript
interface XHSResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  operation?: string;
  context?: Record<string, any>;
}
```

### Success Response
```typescript
{
  success: true,
  data: { /* operation result */ },
  operation: 'operation_name'
}
```

### Error Response
```typescript
{
  success: false,
  error: 'Error description',
  operation: 'operation_name',
  context: { /* additional context */ }
}
```

## Error Handling

### Custom Error Classes
- **XHSError**: Base error class with context
- **AuthenticationError**: Authentication-related errors
- **ValidationError**: Input validation errors
- **NetworkError**: Network-related errors
- **TimeoutError**: Operation timeout errors

### Error Context
```typescript
interface XHSErrorContext {
  operation?: string;
  url?: string;
  feedId?: string;
  keyword?: string;
  timeout?: number;
  attempts?: number;
  [key: string]: any;
}
```

## Configuration Management

### Environment Variables
- `XHS_ENABLE_LOGGING` - Enable debug logging
- `XHS_LOG_LEVEL` - Log level (DEBUG, INFO, WARN, ERROR)
- `XHS_LOG_FILE` - Enable file logging
- `XHS_HEADLESS` - Browser headless mode
- `XHS_BROWSER_TIMEOUT` - Browser operation timeout
- `XHS_LOGIN_TIMEOUT` - Login operation timeout

### Configuration Access
```typescript
import { getConfig } from '../shared/config.js';

const config = getConfig();
const timeout = config.browser.defaultTimeout;
const headless = config.browser.headlessDefault;
```

## Logging

### Logger Usage
```typescript
import { getLogger } from '../shared/logger.js';

const logger = getLogger();
logger.info('Operation started', { context });
logger.error('Operation failed', { error, context });
```

### Log Levels
- **DEBUG**: Minimal debugging information (cleaned up)
- **INFO**: General information about operations
- **WARN**: Warning messages for non-critical issues
- **ERROR**: Error messages for failed operations

### Logging Best Practices
- **Minimal logging** - Only log errors, warnings, and essential information
- **Avoid debug noise** - Remove detailed element inspection and selector attempts
- **Clean output** - Focus on user-relevant information
- **Error context** - Include relevant context in error messages