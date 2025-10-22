# XHS-MCP 使用指南

## 概述

本指南详细介绍如何使用 XHS-MCP 进行小红书自动化操作，包括认证、发布、搜索等功能。

## 🚀 快速开始

### 安装和运行

```bash
# 使用 npx 运行（推荐）
npx xhs-mcp --help

# 或者全局安装
npm install -g xhs-mcp
xhs-mcp --help
```

### 首次使用

1. **检查浏览器依赖**
```bash
npx xhs-mcp browser
```

2. **登录账户**
```bash
npx xhs-mcp login --timeout 120
```

3. **验证登录状态**
```bash
npx xhs-mcp status
```

## 📝 内容发布

### 图文发布

#### 使用本地图片

```bash
npx xhs-mcp publish \
  --type image \
  --title "美丽的风景" \
  --content "分享一张美丽的风景照片" \
  --media-paths "./images/photo1.jpg,./images/photo2.png" \
  --tags "风景,摄影"
```

#### 使用图片 URL（新功能）

```bash
npx xhs-mcp publish \
  --type image \
  --title "网络图片分享" \
  --content "来自网络的高质量图片" \
  --media-paths "https://example.com/image1.jpg,https://example.com/image2.png" \
  --tags "网络,分享"
```

#### 混合使用本地和网络图片

```bash
npx xhs-mcp publish \
  --type image \
  --title "我的相册" \
  --content "本地照片和网络图片的完美结合" \
  --media-paths "https://example.com/remote.jpg,./local/photo.jpg,https://example.com/another.png" \
  --tags "相册,混合"
```

### 视频发布

```bash
npx xhs-mcp publish \
  --type video \
  --title "我的视频" \
  --content "分享一个有趣的视频" \
  --media-paths "./videos/my_video.mp4" \
  --tags "视频,分享"
```

### 支持的格式

#### 图片格式
- JPEG/JPG
- PNG
- GIF
- WebP
- BMP

#### 视频格式
- MP4
- MOV
- AVI
- MKV
- WebM
- FLV
- WMV

## 🔍 内容发现

### 获取推荐内容

```bash
npx xhs-mcp feeds
```

### 搜索笔记

```bash
npx xhs-mcp search -k "美食"
```

### 当前用户笔记

```bash
# 列出当前用户笔记
npx xhs-mcp usernote list [-l 20] [--cursor <cursor>]
```

### 评论笔记

```bash
npx xhs-mcp comment --feed-id <feed_id> --xsec-token <token> -n "很棒的内容！"
```

## 🤖 MCP 服务器模式

### Stdio 模式（默认）

```bash
# 启动 MCP 服务器
npx xhs-mcp mcp

# 启用调试日志
XHS_ENABLE_LOGGING=true npx xhs-mcp mcp
```

### HTTP 模式

```bash
# 启动 HTTP 服务器（默认端口 3000）
npx xhs-mcp mcp --mode http

# 指定端口
npx xhs-mcp mcp --mode http --port 8080

# 启用调试模式
XHS_ENABLE_LOGGING=true npx xhs-mcp mcp --mode http
```

### 客户端配置

#### Cursor 配置

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

#### HTTP 客户端配置

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

## 🛠️ 高级功能

### 图片 URL 自动下载

XHS-MCP 现在支持直接使用 HTTP/HTTPS 图片 URL 进行发布，无需手动下载：

#### 工作原理

1. **URL 识别**：自动识别以 `http://` 或 `https://` 开头的路径
2. **智能下载**：将 URL 图片下载到 `./temp_images/` 目录
3. **格式验证**：检查文件签名，确保是有效的图片格式
4. **缓存机制**：已下载的图片会被缓存，避免重复下载
5. **混合处理**：URL 和本地路径可以混合使用

#### 缓存机制

- 使用 URL 的 SHA256 哈希值生成唯一文件名
- 相同的 URL 只会下载一次
- 缓存的图片可以在多次发布中重复使用

#### 下载位置

默认情况下，下载的图片会保存在项目根目录的 `temp_images/` 文件夹中：

```
xhs-mcp/
├── temp_images/          # 自动创建
│   ├── img_abc123_1234567890.jpg
│   ├── img_def456_1234567891.png
│   └── ...
```

### 错误处理

#### 常见错误及解决方案

**1. 图片下载失败**
```
Error: Failed to download image: HTTP 404 Not Found
```
**解决方案**：检查 URL 是否正确，图片是否仍然存在

**2. 无效的图片格式**
```
Error: Downloaded file is not a valid image
```
**解决方案**：确保 URL 指向的是真实的图片文件，而不是 HTML 页面

**3. 下载超时**
```
Error: Image download timeout after 30000ms
```
**解决方案**：
- 检查网络连接
- 图片可能太大
- 尝试使用本地图片

**4. 本地文件不存在**
```
Error: Local image file not found: ./image.jpg
```
**解决方案**：检查文件路径是否正确

## 📊 性能优化

### 1. 使用缓存

如果需要多次发布相同的图片，第一次下载后会自动缓存：

```bash
# 第一次 - 下载图片（可能需要几秒）
npx xhs-mcp publish --media-paths "https://example.com/large-image.jpg"

# 第二次 - 使用缓存（即时）
npx xhs-mcp publish --media-paths "https://example.com/large-image.jpg"
```

### 2. 预下载图片

对于大批量发布，可以先下载图片到本地：

```bash
# 使用测试脚本下载图片
node examples/test-image-url-download.js
```

### 3. 合理控制并发

避免同时运行多个发布任务，建议串行执行。

## ⚠️ 注意事项

### 发布限制

- **图文发布**：标题≤20字符、内容≤1000字符、图片≤18张
- **视频发布**：文件大小建议≤500MB
- **频率控制**：避免过于频繁的发布操作

### 账号安全

- 避免同账号多端同时网页登录
- 合理控制操作频率
- 定期检查登录状态

### 网络要求

- 确保网络连接稳定
- 图片 URL 需要可以公开访问
- 避免使用需要登录才能访问的图片

## 🔧 调试和故障排除

### 启用调试日志

```bash
XHS_ENABLE_LOGGING=true npx xhs-mcp <command>
```

### 查看下载的图片

```bash
ls -lh temp_images/
```

### 清理缓存

```bash
rm -rf temp_images/
```

### 验证 MCP 连接

```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | npx xhs-mcp mcp
```

## 📚 更多资源

- [图片 URL 发布完整指南](./examples/image-url-publish.md)
- [项目结构文档](./PROJECT_STRUCTURE.md)
- [HTTP 传输文档](./HTTP_TRANSPORTS.md)
- [测试脚本](./examples/test-image-url-download.js)

## 🤝 获取帮助

- 查看可用工具：`npx xhs-mcp tools`
- 查看详细帮助：`npx xhs-mcp <command> --help`
- 提交问题：[GitHub Issues](https://github.com/algovate/xhs-mcp/issues)

---

**提示**：这个功能参考了 [xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp) 项目的优秀实现，特此感谢！
