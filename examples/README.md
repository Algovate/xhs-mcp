---
noteId: "fc6dc960a32b11f0ba9895502e9a78af"
tags: []

---

# Examples

This directory contains example images and usage demonstrations for xhs-mcp.

## 📁 Directory Structure

```
examples/
├── images/              # Example images for publishing demonstrations
│   ├── circle.png       # Simple circle graphic (PNG)
│   ├── circle.svg       # Simple circle graphic (SVG)
│   ├── geometric.png    # Geometric pattern (PNG)
│   ├── geometric.svg    # Geometric pattern (SVG)
│   ├── wave.png         # Wave pattern (PNG)
│   └── wave.svg         # Wave pattern (SVG)
└── README.md           # This file
```

## 🎨 Example Images

These images are provided for testing and demonstrating the publishing functionality:

- **circle**: Simple circular graphics for basic publishing tests
- **geometric**: Geometric patterns for visual variety
- **wave**: Wave patterns for testing different image types

All images are available in both PNG (raster) and SVG (vector) formats.

## 🚀 Usage Examples

### Publishing with Local Images

```bash
# Publish with a single image
npx xhs-mcp publish \
  --type image \
  --title "测试发布" \
  --content "这是一个测试内容" \
  --media-paths "./examples/images/circle.png"

# Publish with multiple images
npx xhs-mcp publish \
  --type image \
  --title "多图测试" \
  --content "发布多张图片" \
  --media-paths "./examples/images/circle.png,./examples/images/geometric.png,./examples/images/wave.png"
```

### Publishing with Image URLs

```bash
# Using image URLs directly
npx xhs-mcp publish \
  --type image \
  --title "网络图片测试" \
  --content "使用网络图片发布" \
  --media-paths "https://picsum.photos/800/600"

# Mix local and remote images
npx xhs-mcp publish \
  --type image \
  --title "混合图片测试" \
  --content "本地和网络图片混合" \
  --media-paths "./examples/images/circle.png,https://picsum.photos/800/600"
```

### Using MCP Tools

```json
{
  "name": "xhs_publish_content",
  "arguments": {
    "type": "image",
    "title": "测试发布",
    "content": "使用MCP工具发布",
    "media_paths": [
      "./examples/images/circle.png",
      "./examples/images/geometric.png"
    ],
    "tags": "测试,示例"
  }
}
```

## 📝 Notes

- These images are meant for **testing and demonstration purposes only**
- When publishing to production, use your own images
- Make sure to follow Xiaohongshu's content guidelines
- Maximum 18 images per post (image posts)
- Supported formats: JPEG, PNG, GIF, WebP, BMP, SVG

## 🔗 Related Documentation

- [Usage Guide](../docs/USAGE_GUIDE.md) - Complete usage documentation
- [Publish Guide](../docs/PUBLISH_GUIDE.md) - Publishing guide
- [README](../README.md) - Main project documentation

