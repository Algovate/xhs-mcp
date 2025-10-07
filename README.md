# xhs-mcp

简体中文 | [English](./README.en.md)

`xhs-mcp` 提供统一的命令行入口 `xhs-mcp`，并内置 MCP 服务器子命令。用于小红书（xiaohongshu.com）的 Model Context Protocol（MCP）服务器与 CLI 工具，支持登录、发布、搜索、推荐等自动化能力（基于 Puppeteer）。

[![npm version](https://img.shields.io/npm/v/xhs-mcp.svg)](https://www.npmjs.com/package/xhs-mcp)
[![npm downloads](https://img.shields.io/npm/dm/xhs-mcp.svg)](https://www.npmjs.com/package/xhs-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📦 NPM 信息

- 包名: `xhs-mcp`
- 运行 CLI（推荐）: `npx xhs-mcp <subcommand>`
- 启动 MCP：`npx xhs-mcp mcp [--mode stdio|http] [--port 3000]`

## ✨ 功能

- 认证：登录、登出、状态检查
- 发布：图文和视频发布
  - **图文发布**：标题≤20、内容≤1000、最多18图
  - **视频发布**：支持 MP4、MOV、AVI、MKV、WebM、FLV、WMV 格式
  - ⭐ **新功能**: 支持图片 URL 自动下载（HTTP/HTTPS）
  - 支持本地图片路径
  - 支持 URL 和本地路径混合使用
  - 智能缓存机制，避免重复下载
- 发现：推荐、搜索、详情、评论
- 自动化：Puppeteer 驱动、无头模式、Cookie 管理

## 📋 可用工具

- `xhs_auth_login`、`xhs_auth_logout`、`xhs_auth_status`
- `xhs_discover_feeds`、`xhs_search_note`、`xhs_get_note_detail`
- `xhs_comment_on_note`
- `xhs_publish_content`（统一发布接口：`type`、`title`、`content`、`media_paths`、`tags`）
  - **图片发布**：1-18个图片文件或URL
  - **视频发布**：恰好1个视频文件
  - **混合使用**：支持图片URL和本地路径混合

## 🚀 快速开始（MCP）

### Stdio 模式（默认）

```bash
npx xhs-mcp mcp

# 调试日志
XHS_ENABLE_LOGGING=true npx xhs-mcp mcp
```

> 首次运行提示：如果未安装 Puppeteer 浏览器，先执行
>
> ```bash
> npx xhs-mcp browser    # 自动检查并安装 Chromium，显示可执行路径
> # 或
> npx puppeteer browsers install chrome
> ```
>
> 输出示例：
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

验证 MCP 连接：

```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | npx xhs-mcp mcp
```

### HTTP 模式

```bash
# 启动 HTTP 服务器（默认端口 3000）
npx xhs-mcp mcp --mode http

# 指定端口
npx xhs-mcp mcp --mode http --port 8080

# 调试模式
XHS_ENABLE_LOGGING=true npx xhs-mcp mcp --mode http
```

HTTP 服务器支持：
- **Streamable HTTP** (协议版本 2025-03-26) - 端点：`/mcp`
- **SSE** (协议版本 2024-11-05) - 端点：`/sse` 和 `/messages`
- **健康检查** - 端点：`/health`

详细文档请参考：[HTTP Transports](./docs/HTTP_TRANSPORTS.md)

## 🧰 CLI 子命令

```bash
# 认证
npx xhs-mcp login --timeout 120
npx xhs-mcp logout
npx xhs-mcp status

# 浏览器依赖
npx xhs-mcp browser [--with-deps]  # 检查并安装 Chromium，显示可执行路径

# 发现与检索
npx xhs-mcp feeds [-b /path/to/chromium]
npx xhs-mcp search -k 关键字 [-b /path/to/chromium]
npx xhs-mcp note-detail --feed-id <id> --xsec-token <token> [-b /path/to/chromium]

# 互动
npx xhs-mcp comment --feed-id <id> --xsec-token <token> -n "Nice!" [-b /path/to/chromium]

# 发布
# 使用本地图片
npx xhs-mcp publish --type image --title 标题 --content 内容 -m path1.jpg,path2.png --tags a,b [-b /path/to/chromium]

# ⭐ 使用图片 URL（自动下载）
npx xhs-mcp publish --type image --title 标题 --content 内容 -m "https://example.com/img1.jpg,https://example.com/img2.png" --tags a,b

# 混合使用 URL 和本地路径
npx xhs-mcp publish --type image --title 标题 --content 内容 -m "https://example.com/img1.jpg,./local/img2.jpg" --tags a,b

# 发布视频
npx xhs-mcp publish --type video --title 视频标题 --content 视频描述 -m path/to/video.mp4 --tags a,b [-b /path/to/chromium]

# 查看可用工具
npx xhs-mcp tools [--detailed] [--json]

# 启动 MCP
npx xhs-mcp mcp [--mode stdio|http] [--port 3000]
```

## 🔧 客户端接入（Cursor）

### Stdio 模式

`.cursor/mcp.json`：

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

### HTTP 模式

`.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "xhs-mcp-http": {
      "command": "npx",
      "args": ["xhs-mcp", "mcp", "--mode", "http", "--port", "3000"],
      "env": { "XHS_ENABLE_LOGGING": "true" }
    }
  }
}
```

或者使用 HTTP 客户端直接连接：

```json
{
  "mcpServers": {
    "xhs-mcp-http": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## ⚠️ 注意事项

- **图文发布**：标题≤20、内容≤1000、图片≤18
- **视频发布**：支持多种格式，文件大小建议≤500MB
- 避免同账号多端同时网页登录
- 合理控制发帖频率
- 图片 URL 自动下载到 `./temp_images/` 目录（自动缓存）
- 图片 URL 支持格式：JPEG、PNG、GIF、WebP、BMP

## 📖 更多示例

- [完整使用指南](./docs/USAGE_GUIDE.md) - 详细的使用说明和最佳实践
- [图片 URL 发布完整指南](./examples/image-url-publish.md) - 了解如何使用图片 URL 功能

## 🙏 致谢

基于 [xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp) 重构与扩展（TypeScript、Puppeteer、MCP 优化、日志清理、NPM 发布）。
