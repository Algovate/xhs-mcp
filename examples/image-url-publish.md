---
noteId: "7fb55e50a32711f0921c75b4e4841245"
tags: []

---

# 使用图片 URL 发布示例

xhs-mcp 现在支持直接使用 HTTP/HTTPS 图片 URL 进行发布，无需手动下载图片！

## 功能特点

- ✅ 自动下载 HTTP/HTTPS 图片 URL
- ✅ 支持本地文件路径
- ✅ 混合使用 URL 和本地路径
- ✅ 自动缓存已下载的图片
- ✅ 完整的错误处理和验证

## 支持的图片格式

- JPEG/JPG
- PNG
- GIF
- WebP
- BMP

## 使用方法

### 方法 1: 纯 URL 发布

```bash
npx xhs-mcp publish \
  --type image \
  --title "美丽的风景" \
  --content "这是一张来自网络的美图" \
  --media-paths "https://example.com/image1.jpg,https://example.com/image2.png"
```

### 方法 2: 混合 URL 和本地路径

```bash
npx xhs-mcp publish \
  --type image \
  --title "我的相册" \
  --content "网络图片和本地图片的完美结合" \
  --media-paths "https://example.com/image1.jpg,./local/image2.jpg,https://example.com/image3.png"
```

### 方法 3: 通过 MCP 工具调用

```json
{
  "name": "xhs_publish_content",
  "arguments": {
    "type": "image",
    "title": "网络图片发布",
    "content": "直接使用图片 URL，超级方便！",
    "media_paths": [
      "https://picsum.photos/800/600",
      "https://picsum.photos/800/601",
      "https://picsum.photos/800/602"
    ],
    "tags": "测试,图片"
  }
}
```

## 实际案例

### 案例 1: 使用 Unsplash 图片

```typescript
// Cursor 中直接使用
{
  type: "image",
  title: "精选美图",
  content: "来自 Unsplash 的高质量图片",
  media_paths: [
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e"
  ]
}
```

### 案例 2: 混合本地和网络图片

```typescript
{
  type: "image",
  title: "我的旅行日记",
  content: "记录美好时光",
  media_paths: [
    "/Users/me/Photos/trip1.jpg",  // 本地照片
    "https://example.com/landmark.jpg",  // 网络地标图
    "/Users/me/Photos/trip2.jpg",  // 本地照片
    "https://example.com/sunset.jpg"  // 网络日落图
  ],
  tags: "旅行,风景"
}
```

### 案例 3: AI 生成图片发布

```typescript
// 使用 AI 生成的图片 URL
{
  type: "image",
  title: "AI 艺术作品",
  content: "由 AI 创作的独特图片",
  media_paths: [
    "https://oaidalleapiprodscus.blob.core.windows.net/...",  // DALL-E
    "https://cdn.midjourney.com/...",  // Midjourney
  ]
}
```

## 工作原理

1. **URL 识别**: 自动识别以 `http://` 或 `https://` 开头的路径
2. **智能下载**: 将 URL 图片下载到 `./temp_images/` 目录
3. **格式验证**: 检查文件签名，确保是有效的图片格式
4. **缓存机制**: 已下载的图片会被缓存，避免重复下载
5. **混合处理**: URL 和本地路径可以混合使用

## 下载位置

默认情况下，下载的图片会保存在项目根目录的 `temp_images/` 文件夹中：

```
xhs-mcp/
├── temp_images/          # 自动创建
│   ├── img_abc123_1234567890.jpg
│   ├── img_def456_1234567891.png
│   └── ...
```

## 缓存机制

- 使用 URL 的 SHA256 哈希值生成唯一文件名
- 相同的 URL 只会下载一次
- 缓存的图片可以在多次发布中重复使用

## 错误处理

### 常见错误及解决方案

#### 1. 图片下载失败

```
Error: Failed to download image: HTTP 404 Not Found
```

**解决方案**: 检查 URL 是否正确，图片是否仍然存在

#### 2. 无效的图片格式

```
Error: Downloaded file is not a valid image
```

**解决方案**: 确保 URL 指向的是真实的图片文件，而不是 HTML 页面

#### 3. 下载超时

```
Error: Image download timeout after 30000ms
```

**解决方案**: 
- 检查网络连接
- 图片可能太大
- 尝试使用本地图片

#### 4. 本地文件不存在

```
Error: Local image file not found: ./image.jpg
```

**解决方案**: 检查文件路径是否正确

## 性能优化

### 1. 使用缓存

如果需要多次发布相同的图片，第一次下载后会自动缓存：

```typescript
// 第一次 - 下载图片（3 秒）
await publish({ 
  media_paths: ["https://example.com/large-image.jpg"] 
});

// 第二次 - 使用缓存（即时）
await publish({ 
  media_paths: ["https://example.com/large-image.jpg"] 
});
```

### 2. 预下载图片

对于大批量发布，可以先下载图片到本地：

```typescript
import { ImageDownloader } from 'xhs-mcp';

const downloader = new ImageDownloader();
const localPaths = await downloader.downloadImages([
  "https://example.com/img1.jpg",
  "https://example.com/img2.jpg",
  // ... 更多 URL
]);

// 然后使用本地路径发布
await publish({ media_paths: localPaths });
```

## 最佳实践

### ✅ 推荐

1. **使用高质量图片**: 小红书推荐 800x600 以上的图片
2. **混合使用**: 本地重要图片 + 网络装饰图片
3. **检查版权**: 使用网络图片时注意版权问题
4. **压缩大图**: 大于 5MB 的图片建议先压缩

### ❌ 不推荐

1. 使用动态 URL（每次访问返回不同图片）
2. 使用需要登录才能访问的图片
3. 使用超大图片（> 10MB）
4. 一次发布过多图片（建议 ≤ 9 张）

## 与其他工具集成

### 集成 AI 图片生成

```typescript
// 1. 生成图片（假设返回 URL）
const imageUrl = await generateImage("beautiful landscape");

// 2. 直接发布
await publish({
  title: "AI 生成的风景",
  content: "来自 AI 的创作",
  media_paths: [imageUrl]
});
```

### 集成图片爬虫

```typescript
// 1. 爬取图片 URL
const imageUrls = await scrapeImages("https://example.com");

// 2. 批量发布
for (const url of imageUrls) {
  await publish({
    title: "精选图片",
    content: "来自网络的精彩图片",
    media_paths: [url]
  });
}
```

## 技术细节

### 文件命名规则

```
img_<hash>_<timestamp>.<extension>

示例:
img_abc123def456_1234567890.jpg
```

- `hash`: URL 的 SHA256 哈希值前 16 位
- `timestamp`: Unix 时间戳
- `extension`: 根据文件签名自动检测

### 支持的文件签名

- **JPEG**: `FF D8 FF`
- **PNG**: `89 50 4E 47`
- **GIF**: `47 49 46`
- **WebP**: `52 49 46 46 ... 57 45 42 50`
- **BMP**: `42 4D`

## 故障排除

### 启用调试日志

```bash
XHS_ENABLE_LOGGING=true npx xhs-mcp publish ...
```

### 查看下载的图片

```bash
ls -lh temp_images/
```

### 清理缓存

```bash
rm -rf temp_images/
```

## 更新日志

- **v0.7.3**: 新增图片 URL 自动下载功能
  - 支持 HTTP/HTTPS 图片 URL
  - 自动缓存机制
  - 完整的错误处理
  - 文件签名验证

## 相关链接

- [GitHub 仓库](https://github.com/algovate/xhs-mcp)
- [问题反馈](https://github.com/algovate/xhs-mcp/issues)
- [功能建议](https://github.com/algovate/xhs-mcp/discussions)

---

**提示**: 这个功能参考了 [xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp) 项目的优秀实现，特此感谢！

