---
inclusion: always
---

# XiaoHongShu Integration Patterns

## Platform Constraints

### Content Limits
- **Title**: Maximum 20 characters
- **Content**: Maximum 1000 characters
- **Images**: Maximum 18 images per post
- **Tags**: Comma-separated list of tags

### Rate Limiting
- **Avoid concurrent logins** - Don't login from multiple devices simultaneously
- **Control posting frequency** - Implement delays between posts
- **Respect platform limits** - Follow XiaoHongShu's terms of service

## Authentication Flow

### Login Process
1. **Navigate to home page** - `https://www.xiaohongshu.com`
2. **Wait for login selector** - `.main-container .user .link-wrapper .channel`
3. **Handle QR code or password login** - Support both methods
4. **Save cookies** - Persist authentication state
5. **Validate login** - Check for successful authentication

### Cookie Management
- **Save location**: `~/.xhs-mcp/cookies.json`
- **Cookie validation** - Check if cookies are still valid
- **Automatic refresh** - Re-login if cookies expire
- **Secure storage** - Handle sensitive authentication data

## Content Operations

### Feed Discovery
- **Explore page**: `https://www.xiaohongshu.com/explore`
- **Parse feed items** - Extract title, content, images, user info
- **Handle pagination** - Support multiple pages of content
- **Filter content** - Support content type filtering

### Search Functionality
- **Search URL**: `https://www.xiaohongshu.com/search_result`
- **Keyword encoding** - Properly encode search terms
- **Result parsing** - Extract search results in consistent format
- **Pagination support** - Handle multiple search result pages

### Content Publishing
- **Publish URL**: `https://creator.xiaohongshu.com/publish/publish?source=official`
- **Image upload** - Support multiple image formats (JPG, PNG, etc.)
- **Content validation** - Check character limits before publishing
- **Tag processing** - Convert comma-separated tags to platform format

## Selector Patterns

### Login Detection
```css
.main-container .user .link-wrapper .channel
```

### Content Selectors
- **Feed items** - Use data attributes when available
- **User information** - Extract user ID, nickname, avatar
- **Interaction data** - Likes, comments, shares, collections
- **Timestamps** - Convert to consistent format

### Form Elements
- **Title input** - Locate title input field
- **Content textarea** - Find content input area
- **Image upload** - Handle file input elements
- **Tag input** - Process tag input field
- **Submit button** - Locate publish/submit button

## Error Handling

### Common Errors
- **Login timeout** - Handle slow login process
- **Cookie expiration** - Detect and handle expired sessions
- **Rate limiting** - Handle too many requests
- **Content validation** - Handle invalid content format
- **Network errors** - Handle connection issues

### Retry Strategies
- **Exponential backoff** - Increase delay between retries
- **Max retry attempts** - Prevent infinite retry loops
- **Context preservation** - Maintain operation context across retries
- **Error classification** - Different retry strategies for different errors

## Data Models

### Feed Item Structure
```typescript
interface FeedItem {
  id: string;
  type: string;
  title: string;
  desc: string;
  images: string[];
  user: {
    id: string;
    nickname: string;
    avatar: string;
  };
  interact_info: {
    liked: boolean;
    liked_count: string;
    collected: boolean;
    collected_count: string;
    comment_count: string;
    share_count: string;
  };
  time: number;
  last_update_time: number;
}
```

### Publish Parameters
```typescript
interface PublishParams {
  title: string;        // Max 20 characters
  content: string;      // Max 1000 characters
  image_paths: string[]; // Max 18 images
  tags: string;         // Comma-separated tags
}
```

## Best Practices

### Respectful Automation
- **Human-like behavior** - Add delays between actions
- **Respect rate limits** - Don't overwhelm the platform
- **Handle errors gracefully** - Don't crash on expected errors
- **Log operations** - Track what the automation is doing

### Data Privacy
- **Secure cookie storage** - Protect authentication data
- **Minimal data collection** - Only collect necessary information
- **User consent** - Ensure users understand what data is accessed
- **Data cleanup** - Remove temporary data after operations