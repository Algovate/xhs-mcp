# Design Document

## Overview

This design document outlines the architectural improvements for the XiaoHongShu MCP Server project. The improvements focus on enhancing reliability, performance, security, and maintainability while maintaining backward compatibility and following established patterns.

## Architecture

### Current Architecture Analysis

The existing system follows a clean layered architecture:
- **Entry Layer**: CLI and MCP server entry points
- **Handler Layer**: MCP tool and resource handlers
- **Service Layer**: Domain services (Auth, Feed, Publishing, Browser)
- **Shared Layer**: Common utilities, configuration, and types

### Proposed Architecture Enhancements

#### 1. Testing Infrastructure
```
tests/
├── unit/                    # Unit tests for individual components
│   ├── services/           # Service layer tests
│   ├── handlers/           # Handler tests
│   └── utils/              # Utility function tests
├── integration/            # Integration tests
│   ├── mcp/               # MCP protocol tests
│   └── browser/           # Browser automation tests
├── e2e/                   # End-to-end tests
├── fixtures/              # Test data and fixtures
└── helpers/               # Test utilities and mocks
```

#### 2. Enhanced Configuration System
```typescript
// New configuration architecture
interface ConfigSchema {
  server: ServerConfig;
  browser: BrowserConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
  performance: PerformanceConfig;
}

// Configuration validation with Zod
const configSchema = z.object({
  server: serverConfigSchema,
  browser: browserConfigSchema,
  // ... other schemas
});
```

#### 3. Security Layer
```
src/lib/security/
├── encryption.service.ts   # Cookie encryption/decryption
├── validation.service.ts   # Input validation and sanitization
├── rate-limiter.service.ts # Rate limiting implementation
└── audit.service.ts        # Security audit logging
```

#### 4. Performance Layer
```
src/lib/performance/
├── browser-pool.service.ts # Browser instance pooling
├── cache.service.ts        # Intelligent caching
├── metrics.service.ts      # Performance metrics collection
└── resource-manager.ts     # Resource lifecycle management
```

## Components and Interfaces

### 1. Enhanced Browser Management

#### Browser Pool Service
```typescript
interface BrowserPoolService {
  acquireBrowser(options?: BrowserOptions): Promise<ManagedBrowser>;
  releaseBrowser(browser: ManagedBrowser): Promise<void>;
  getPoolStats(): BrowserPoolStats;
  cleanup(): Promise<void>;
}

interface ManagedBrowser {
  browser: Browser;
  context: BrowserContext;
  id: string;
  createdAt: Date;
  lastUsed: Date;
  isAvailable: boolean;
}
```

#### Enhanced Browser Manager
```typescript
interface EnhancedBrowserManager extends BrowserManager {
  createPageWithRetry(options: PageOptions): Promise<Page>;
  waitForSelectorWithFallback(page: Page, selectors: string[]): Promise<ElementHandle>;
  performActionWithRetry<T>(action: () => Promise<T>, context: string): Promise<T>;
  captureScreenshotOnError(page: Page, error: Error): Promise<string>;
}
```

### 2. Security Components

#### Encryption Service
```typescript
interface EncryptionService {
  encryptCookies(cookies: Cookie[]): Promise<string>;
  decryptCookies(encryptedData: string): Promise<Cookie[]>;
  generateSecureKey(): string;
  validateIntegrity(data: string, signature: string): boolean;
}
```

#### Input Validation Service
```typescript
interface ValidationService {
  validateToolInput(toolName: string, input: any): ValidationResult;
  sanitizeUserInput(input: string): string;
  validateFileUpload(filePath: string): FileValidationResult;
  checkRateLimit(operation: string, identifier: string): RateLimitResult;
}
```

### 3. Performance Components

#### Cache Service
```typescript
interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
  getStats(): CacheStats;
}
```

#### Metrics Service
```typescript
interface MetricsService {
  recordOperation(operation: string, duration: number, success: boolean): void;
  recordBrowserAction(action: string, metadata: Record<string, any>): void;
  getMetrics(): OperationMetrics;
  exportPrometheusMetrics(): string;
}
```

### 4. Enhanced Error Handling

#### Structured Error System
```typescript
interface StructuredError extends XHSError {
  correlationId: string;
  timestamp: Date;
  severity: ErrorSeverity;
  category: ErrorCategory;
  retryable: boolean;
  context: EnhancedErrorContext;
}

interface ErrorRecoveryStrategy {
  canRecover(error: StructuredError): boolean;
  recover(error: StructuredError, context: OperationContext): Promise<RecoveryResult>;
}
```

### 5. Enhanced Logging System

#### Structured Logger
```typescript
interface StructuredLogger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  
  withCorrelationId(id: string): StructuredLogger;
  withContext(context: LogContext): StructuredLogger;
}

interface LogContext {
  operation?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}
```

## Data Models

### Enhanced Configuration Models
```typescript
interface SecurityConfig {
  cookieEncryption: {
    enabled: boolean;
    algorithm: string;
    keyRotationInterval: number;
  };
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  inputValidation: {
    strictMode: boolean;
    sanitizeHtml: boolean;
    maxInputLength: number;
  };
}

interface PerformanceConfig {
  browserPool: {
    minInstances: number;
    maxInstances: number;
    idleTimeout: number;
    maxAge: number;
  };
  caching: {
    enabled: boolean;
    defaultTtl: number;
    maxSize: number;
  };
  metrics: {
    enabled: boolean;
    exportInterval: number;
    retentionPeriod: number;
  };
}
```

### Enhanced Response Models
```typescript
interface EnhancedXHSResponse<T = any> extends XHSResponse<T> {
  correlationId: string;
  timestamp: Date;
  duration?: number;
  cached?: boolean;
  retryCount?: number;
}

interface OperationMetrics {
  totalOperations: number;
  successRate: number;
  averageDuration: number;
  errorsByType: Record<string, number>;
  performancePercentiles: {
    p50: number;
    p95: number;
    p99: number;
  };
}
```

## Error Handling

### Enhanced Error Classification
```typescript
enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  BROWSER_AUTOMATION = 'browser_automation',
  NETWORK = 'network',
  VALIDATION = 'validation',
  RATE_LIMITING = 'rate_limiting',
  SYSTEM = 'system'
}
```

### Recovery Strategies
```typescript
interface RecoveryStrategies {
  authentication: AuthenticationRecoveryStrategy;
  browserAutomation: BrowserRecoveryStrategy;
  network: NetworkRecoveryStrategy;
  rateLimit: RateLimitRecoveryStrategy;
}
```

### Circuit Breaker Pattern
```typescript
interface CircuitBreaker {
  execute<T>(operation: () => Promise<T>, context: string): Promise<T>;
  getState(): CircuitBreakerState;
  reset(): void;
}

enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}
```

## Testing Strategy

### Unit Testing
- **Service Layer**: Mock external dependencies (browser, file system)
- **Handler Layer**: Mock service dependencies
- **Utility Functions**: Test pure functions with comprehensive edge cases
- **Configuration**: Test validation and environment variable handling

### Integration Testing
- **MCP Protocol**: Test tool and resource handlers with real MCP client
- **Browser Automation**: Test with headless browser instances
- **Database Operations**: Test cookie storage and retrieval
- **Configuration Loading**: Test with various environment configurations

### End-to-End Testing
- **Authentication Flow**: Complete login/logout cycle
- **Content Operations**: Search, discovery, and publishing workflows
- **Error Scenarios**: Network failures, timeouts, invalid inputs
- **Performance**: Load testing with multiple concurrent operations

### Test Infrastructure
```typescript
// Test utilities
interface TestBrowserManager {
  createMockBrowser(): MockBrowser;
  createTestPage(): MockPage;
  simulateNetworkError(): void;
  simulateTimeout(): void;
}

interface TestDataFactory {
  createFeedItem(overrides?: Partial<FeedItem>): FeedItem;
  createAuthResult(success: boolean): LoginResult;
  createMockCookies(): Cookie[];
}
```

## Performance Optimizations

### Browser Instance Pooling
- **Pool Management**: Maintain 2-5 browser instances based on load
- **Lifecycle Management**: Automatic cleanup of idle instances
- **Resource Monitoring**: Track memory usage and performance metrics
- **Failover**: Automatic instance replacement on failures

### Intelligent Caching
- **Feed Data**: Cache search results and feed lists with TTL
- **Authentication State**: Cache login status checks
- **Configuration**: Cache parsed configuration objects
- **Browser State**: Cache page contexts for repeated operations

### Resource Management
- **Memory Monitoring**: Track and limit memory usage
- **Connection Pooling**: Reuse HTTP connections where possible
- **Garbage Collection**: Explicit cleanup of large objects
- **Async Operations**: Proper cancellation and timeout handling

## Security Enhancements

### Cookie Encryption
```typescript
// AES-256-GCM encryption for cookie storage
interface CookieEncryption {
  encrypt(cookies: Cookie[], key: string): Promise<EncryptedCookieData>;
  decrypt(data: EncryptedCookieData, key: string): Promise<Cookie[]>;
  rotateKey(): Promise<string>;
}
```

### Input Validation
```typescript
// Comprehensive input validation using Zod schemas
const toolInputSchemas = {
  xhs_search_note: z.object({
    keyword: z.string().min(1).max(100).regex(/^[a-zA-Z0-9\s\u4e00-\u9fff]+$/),
    browser_path: z.string().optional()
  }),
  // ... other tool schemas
};
```

### Rate Limiting
```typescript
// Token bucket algorithm for rate limiting
interface RateLimiter {
  checkLimit(operation: string, identifier: string): Promise<RateLimitResult>;
  resetLimit(operation: string, identifier: string): Promise<void>;
  getUsage(operation: string, identifier: string): Promise<UsageStats>;
}
```

## Monitoring and Observability

### Health Checks
```typescript
interface HealthCheckService {
  checkOverallHealth(): Promise<HealthStatus>;
  checkBrowserHealth(): Promise<ComponentHealth>;
  checkAuthenticationHealth(): Promise<ComponentHealth>;
  checkDependencyHealth(): Promise<DependencyHealth[]>;
}
```

### Metrics Collection
- **Operation Metrics**: Success rates, duration, error counts
- **Browser Metrics**: Page load times, memory usage, crash rates
- **System Metrics**: CPU usage, memory consumption, disk I/O
- **Business Metrics**: Login success rates, publishing success rates

### Alerting
- **Error Rate Thresholds**: Alert on high error rates
- **Performance Degradation**: Alert on slow response times
- **Resource Exhaustion**: Alert on high memory/CPU usage
- **Authentication Issues**: Alert on login failures

This design provides a comprehensive foundation for implementing the identified improvements while maintaining the existing architecture's strengths and ensuring backward compatibility.