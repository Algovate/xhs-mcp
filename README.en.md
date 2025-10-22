# xhs-mcp

English | [简体中文](./README.md)

Unified CLI `xhs-mcp` with built-in MCP server subcommand. Automate XiaoHongShu (xiaohongshu.com) with Puppeteer: login, publishing, search, feed discovery, and commenting via MCP and CLI.

[![npm version](https://img.shields.io/npm/v/xhs-mcp.svg)](https://www.npmjs.com/package/xhs-mcp)
[![npm downloads](https://img.shields.io/npm/dm/xhs-mcp.svg)](https://www.npmjs.com/package/xhs-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📦 NPM

- Package: `xhs-mcp`
- Run CLI: `npx xhs-mcp <subcommand>`
- Start MCP: `npx xhs-mcp mcp [--mode stdio|http] [--port 3000]`

## ✨ Features

- Auth: login, logout, status check
- Publish: unified content publishing
  - **Images**: 1-18 files or URLs
  - **Videos**: exactly 1 file
  - ⭐ **New**: Auto-download image URLs (HTTP/HTTPS)
  - ⭐ **New**: Precise title width validation (CJK: 2 units, ASCII: 1 unit)
  - Support local paths and URLs mixed
  - Smart caching to avoid duplicate downloads
- Discover: home feeds, keyword search, note detail, comment
- User Notes: list, delete management
- Automation: Puppeteer-driven, headless mode, cookie management

## 📋 Tools

- `xhs_auth_login`, `xhs_auth_logout`, `xhs_auth_status`
- `xhs_discover_feeds`, `xhs_search_note`, `xhs_get_note_detail`
- `xhs_comment_on_note`
- `xhs_get_user_notes`, `xhs_delete_note` (user note management)
- `xhs_publish_content` (unified interface: `type`, `title`, `content`, `media_paths`, `tags`)
  - **Images**: 1-18 image files or URLs
  - **Videos**: exactly 1 video file
  - **Mixed**: Support image URLs and local paths together

## 🚀 Quick Start (MCP)

```bash
npx xhs-mcp mcp

# Debug logs
XHS_ENABLE_LOGGING=true npx xhs-mcp mcp
```

> First run tip: if Puppeteer browsers are not installed yet, run
>
> ```bash
> npx xhs-mcp browser    # auto-check and install Chromium, shows executable path
> # or
> npx puppeteer browsers install chrome
> ```
>
> Output example:
> ```json
> {
>   "success": true,
>   "message": "Chromium is ready",
>   "data": {
>     "installed": true,
>     "executablePath": "/path/to/chromium"
>   }
> }
> ```

Verify MCP connection:

```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | npx xhs-mcp mcp
```

## 🧰 CLI

```bash
# Auth
npx xhs-mcp login --timeout 120
npx xhs-mcp logout
npx xhs-mcp status

# Browser
npx xhs-mcp browser  # check and install Chromium, shows executable path

# Discover
npx xhs-mcp feeds
npx xhs-mcp search -k keyword

# Current user's notes
npx xhs-mcp usernote list [-l 20] [--cursor <cursor>]

# Delete user notes
npx xhs-mcp usernote delete --note-id <id>
npx xhs-mcp usernote delete --last-published

# Interact
npx xhs-mcp comment --feed-id <id> --xsec-token <token> -n "Nice!"

# Publish with local images
npx xhs-mcp publish --type image --title Title --content Content -m path1.jpg,path2.png --tags a,b

# ⭐ Publish with image URLs (auto-download)
npx xhs-mcp publish --type image --title Title --content Content -m "https://example.com/img1.jpg,https://example.com/img2.png" --tags a,b

# Mix URLs and local paths
npx xhs-mcp publish --type image --title Title --content Content -m "https://example.com/img1.jpg,./local/img2.jpg" --tags a,b

# Video
npx xhs-mcp publish --type video --title Title --content Content -m video.mp4 --tags a,b

# Tools
npx xhs-mcp tools [--detailed] [--json]

# MCP Server
npx xhs-mcp mcp --mode http --port 3000
```

## 🔧 Client Integration (Cursor)

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "xhs-mcp": {
      "command": "npx",
      "args": ["xhs-mcp", "mcp"],
      "env": { "XHS_ENABLE_LOGGING": "true" }
    }
  }
}
```

## ⚠️ Notes

- **Images**: Title≤20 chars (40 display units), content≤1000, 1-18 images
- **Videos**: exactly 1 video file, recommended size ≤500MB
- Avoid multiple web logins for the same account simultaneously
- Keep reasonable posting frequency
- Image URLs auto-download to `./temp_images/` directory (cached)
- Supported image formats: JPEG, PNG, GIF, WebP, BMP

## 📖 Documentation and Examples

### 📚 Documentation
- [Usage Guide](./docs/USAGE_GUIDE.md) - Detailed usage and best practices
- [HTTP Transports](./docs/HTTP_TRANSPORTS.md) - HTTP/SSE mode configuration
- [Publish Guide](./docs/PUBLISH_GUIDE.md) - NPM publishing process

## 🛠️ Build Notes

- Unified single production build config: `config/webpack.config.js`
- Development and optimized variants have been removed.
- For development:
  - `npm run dev` (run TypeScript CLI directly)
  - `npm run build` (bundle to `dist/xhs-mcp.js`)

### 🎨 Examples
- [Examples](./examples/README.md) - Image and publishing examples
- [Sample Images](./examples/images/) - Test images

### 🧪 Tests
- [Run Tests](./tests/README.md) - Testing guide
- Run all tests: `npm test`

## 🙏 Acknowledgments

Based on and extended from [xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp) (refactored to TypeScript, improved MCP implementation, log cleanup, published to NPM).
