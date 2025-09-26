---
inclusion: fileMatch
fileMatchPattern: ['src/lib/browser/**/*.ts', 'src/lib/**/browser*.ts']
---

# Browser Automation Patterns

## Puppeteer Integration

This project uses Puppeteer for browser automation with XiaoHongShu.

### Browser Manager

- **BrowserManager**: [src/lib/browser/browser.manager.ts](mdc:src/lib/browser/browser.manager.ts) - Centralized browser management
- **Browser Types**: [src/lib/browser/browser.types.ts](mdc:src/lib/browser/browser.types.ts) - Browser-related type definitions

## Configuration

### Browser Settings
```typescript
const browserConfig: BrowserConfig = {
  defaultTimeout: 30000,        // Default operation timeout
  loginTimeout: 300,           // Login-specific timeout (5 minutes)
  pageLoadTimeout: 30000,      // Page load timeout
  navigationTimeout: 30000,    // Navigation timeout
  slowmo: 0,                   // Slow down operations (ms)
  headlessDefault: true        // Run headless by default
};
```

### Environment Variables
- `XHS_HEADLESS` - Override headless mode (true/false)
- `XHS_BROWSER_TIMEOUT` - Override default timeout
- `XHS_LOGIN_TIMEOUT` - Override login timeout

## Best Practices

### Page Management
- **Always close pages** - Use try/finally to ensure page cleanup
- **Wait for selectors** - Use `page.waitForSelector()` before interactions
- **Handle timeouts gracefully** - Catch timeout errors and provide context
- **Use proper selectors** - Prefer data attributes over CSS classes
- **Element interactions** - Use `page.$()` and `page.$$()` for element selection

### Cookie Management
- **Save cookies after login** - Persist authentication state
- **Load cookies before operations** - Restore authentication state
- **Validate cookie freshness** - Check if cookies are still valid
- **Handle cookie errors** - Gracefully handle missing or invalid cookies

### Error Handling
```typescript
try {
  await page.goto(url, { timeout: config.browser.pageLoadTimeout });
  await page.waitForSelector(selector, { timeout: config.browser.defaultTimeout });
  // Perform operation
} catch (error) {
  if (error.name === 'TimeoutError') {
    throw new Error(`Operation timed out: ${operation}`);
  }
  throw error;
} finally {
  await page.close();
}
```

### Retry Logic
- **Implement retry for network operations** - Handle temporary failures
- **Exponential backoff** - Increase delay between retries
- **Max retry attempts** - Prevent infinite retry loops
- **Minimal logging** - Only log errors and warnings, avoid debug noise

## XiaoHongShu Specific

### Selectors
- **Login success**: `.main-container .user .link-wrapper .channel`
- **Content areas**: Use data attributes when available
- **Dynamic content**: Wait for specific elements to appear

### URLs
- **Home**: `https://www.xiaohongshu.com`
- **Explore**: `https://www.xiaohongshu.com/explore`
- **Search**: `https://www.xiaohongshu.com/search_result`
- **Publish**: `https://creator.xiaohongshu.com/publish/publish?source=official`