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
- Publish: unified content publishing (images: 1-18 files, videos: exactly 1 file)
- Discover: home feeds, keyword search, note detail, comment
- Automation: Puppeteer-driven, headless mode, cookie management

## 📋 Tools

- `xhs_auth_login`, `xhs_auth_logout`, `xhs_auth_status`
- `xhs_discover_feeds`, `xhs_search_note`, `xhs_get_note_detail`
- `xhs_comment_on_note`
- `xhs_publish_content` (unified interface: `type`, `title`, `content`, `media_paths`, `tags`)
  - Images: 1-18 image files
  - Videos: exactly 1 video file

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
npx xhs-mcp login --timeout 120
npx xhs-mcp logout
npx xhs-mcp status
 npx xhs-mcp browser  # check and install Chromium, shows executable path
 npx xhs-mcp feeds
 npx xhs-mcp search -k keyword
 npx xhs-mcp note-detail --feed-id <id> --xsec-token <token>
 npx xhs-mcp comment --feed-id <id> --xsec-token <token> -n "Nice!"
 npx xhs-mcp publish --type image --title Title --content Content -m path1.jpg,path2.png --tags a,b
 npx xhs-mcp publish --type video --title Title --content Content -m video.mp4 --tags a,b
 npx xhs-mcp tools [--detailed] [--json]
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

- Title≤20, content≤1000, images: 1-18 files, videos: exactly 1 file
- Avoid multiple web logins for the same account simultaneously
- Keep reasonable posting frequency

## 🙏 Acknowledgments

Based on and extended from [xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp) (refactored to TypeScript, improved MCP implementation, log cleanup, published to NPM).
