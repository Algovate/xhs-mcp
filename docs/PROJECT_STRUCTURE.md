---
noteId: "a5593dc09cdd11f0a4d7f746680a0643"
tags: []

---

# XHS-MCP 项目结构文档

## 概述

本文档描述了XHS-MCP项目的文件组织结构，该结构经过重新设计以提高可维护性、可读性和开发效率。

## 目录结构

```
xhs-mcp/
├── src/                           # 源代码目录
│   ├── cli/                       # CLI命令行接口
│   │   └── cli.ts                 # 统一的CLI入口点
│   ├── core/                      # 核心功能模块
│   │   ├── auth/                  # 认证模块
│   │   │   ├── auth.service.ts    # 认证服务
│   │   │   ├── auth.types.ts      # 认证类型定义
│   │   │   └── index.ts           # 模块导出
│   │   ├── browser/               # 浏览器管理模块
│   │   │   ├── browser.manager.ts # 浏览器管理器
│   │   │   ├── browser-pool.service.ts # 浏览器池服务
│   │   │   ├── browser.types.ts   # 浏览器类型定义
│   │   │   └── index.ts           # 模块导出
│   │   ├── feeds/                 # 内容发现模块
│   │   │   ├── feed.service.ts    # 内容发现服务
│   │   │   ├── feed.types.ts      # 内容发现类型定义
│   │   │   └── index.ts           # 模块导出
│   │   ├── publishing/            # 内容发布模块
│   │   │   ├── publish.service.ts # 内容发布服务
│   │   │   ├── publish.types.ts   # 内容发布类型定义
│   │   │   └── index.ts           # 模块导出
│   │   └── index.ts               # 核心模块统一导出
│   ├── server/                    # MCP服务器模块
│   │   ├── handlers/              # 请求处理器
│   │   │   ├── tool.handlers.ts   # 工具请求处理器
│   │   │   ├── resource.handlers.ts # 资源请求处理器
│   │   │   └── index.ts           # 处理器导出
│   │   ├── schemas/               # 模式定义
│   │   │   └── tool.schemas.ts    # 工具和资源模式
│   │   ├── http.server.ts         # HTTP传输服务器
│   │   ├── mcp.server.ts          # 标准MCP服务器
│   │   └── index.ts               # 服务器模块导出
│   ├── shared/                    # 共享工具和类型
│   │   ├── base.service.ts        # 基础服务类
│   │   ├── config.ts              # 配置管理
│   │   ├── cookies.ts             # Cookie管理
│   │   ├── errors.ts              # 错误处理
│   │   ├── image-downloader.ts    # 图片下载器
│   │   ├── title-validator.ts     # 标题宽度验证器
│   │   ├── logger.ts              # 日志记录
│   │   ├── types.ts               # 共享类型定义
│   │   ├── utils.ts               # 工具函数
│   │   ├── xhs.utils.ts           # XHS特定工具
│   │   └── index.ts               # 共享模块导出
│   └── index.ts                   # 主入口文件
├── tests/                         # 测试目录
│   ├── integration/               # 集成测试
│   │   ├── image-downloader.test.js # 图片下载测试
│   │   └── title-validation.test.js # 标题验证测试
│   ├── fixtures/                  # 测试数据
│   │   └── Bert.jpg               # 测试图片
│   └── README.md                  # 测试说明
├── examples/                      # 示例文件
│   ├── images/                    # 示例图片
│   │   ├── circle.png             # 圆形图案（PNG）
│   │   ├── circle.svg             # 圆形图案（SVG）
│   │   ├── geometric.png          # 几何图案（PNG）
│   │   ├── geometric.svg          # 几何图案（SVG）
│   │   ├── wave.png               # 波浪图案（PNG）
│   │   └── wave.svg               # 波浪图案（SVG）
│   └── README.md                  # 示例说明
├── config/                        # 配置文件目录
│   ├── tsconfig.json              # TypeScript配置
│   ├── tsconfig.webpack.json      # Webpack专用TS配置
│   ├── webpack.config.js          # Webpack生产配置
│   ├── webpack.dev.config.js      # Webpack开发配置
│   ├── webpack.optimized.config.js # Webpack优化配置
│   └── eslint.config.js           # ESLint配置
├── docs/                          # 文档目录
│   ├── HTTP_TRANSPORTS.md         # HTTP传输文档
│   ├── PUBLISH_GUIDE.md           # 发布指南
│   ├── USAGE_GUIDE.md             # 使用指南
│   ├── WEBPACK_OPTIMIZATION.md    # Webpack优化报告
│   └── PROJECT_STRUCTURE.md       # 项目结构文档（本文件）
├── dist/                          # 构建输出目录
│   ├── xhs-cli.js                 # 构建的CLI工具
│   └── [类型定义文件]              # TypeScript声明文件
├── package.json                   # 项目配置
├── package-lock.json              # 依赖锁定文件
├── README.md                      # 项目说明（中文）
├── README.en.md                   # 项目说明（英文）
└── LICENSE                        # 许可证
```

## 设计原则

### 1. 模块化组织
- **核心功能分离**: 将认证、浏览器管理、内容发现、内容发布分离为独立的core模块
- **共享资源集中**: 所有共享的工具、类型、配置集中在shared目录
- **服务器功能独立**: MCP服务器相关功能独立组织

### 2. 清晰的层次结构
- **src/**: 源代码根目录
- **core/**: 核心业务逻辑
- **server/**: 服务器相关功能
- **shared/**: 跨模块共享资源
- **cli/**: 命令行接口

### 3. 配置集中管理
- **config/**: 所有配置文件集中管理
- **分离关注点**: 开发、生产、优化配置分离
- **路径统一**: 配置文件路径统一管理

## 模块职责

### CLI模块 (`src/cli/`)
- 统一的命令行接口
- 集成所有功能命令
- 处理用户输入和输出

### 核心模块 (`src/core/`)
- **auth/**: 用户认证和会话管理
- **browser/**: 浏览器自动化和池管理
- **feeds/**: 内容发现和搜索
- **publishing/**: 内容发布和管理

### 服务器模块 (`src/server/`)
- MCP协议实现
- HTTP和stdio传输支持
- 请求处理和路由

### 共享模块 (`src/shared/`)
- 配置管理
- 错误处理
- 日志记录
- 工具函数
- 类型定义
- 图片下载器（支持URL自动下载和缓存）
- 标题验证器（精确的宽度计算）

### 测试模块 (`tests/`)
- **integration/**: 集成测试脚本
  - 图片下载功能测试
  - 标题验证功能测试
- **fixtures/**: 测试数据和示例文件

### 示例模块 (`examples/`)
- **images/**: 用于演示发布功能的示例图片
- **README.md**: 使用示例和说明

## 导入路径规范

### 相对路径规则
```typescript
// CLI中导入核心模块
import { AuthService } from '../core/auth/auth.service';

// 核心模块中导入共享模块
import { Config } from '../../shared/types';

// 服务器模块中导入核心模块
import { AuthService } from '../../core/auth/auth.service';

// 服务器模块中导入共享模块
import { getConfig } from '../../shared/config';
```

### 别名路径（可选）
```typescript
// 使用@别名（在webpack中配置）
import { AuthService } from '@/core/auth/auth.service';
import { getConfig } from '@/shared/config';
```

## 构建配置

### TypeScript配置
- **config/tsconfig.json**: 主TypeScript配置
- **config/tsconfig.webpack.json**: Webpack专用配置

### Webpack配置
- **config/webpack.config.js**: 标准生产构建
- **config/webpack.dev.config.js**: 开发构建
- **config/webpack.optimized.config.js**: 优化构建

### 构建脚本
```json
{
  "build": "标准生产构建",
  "build:dev": "开发构建",
  "build:optimized": "优化构建",
  "watch": "监听模式"
}
```

## 开发指南

### 添加新功能
1. 确定功能所属的核心模块
2. 在对应的core子目录中添加文件
3. 更新模块的index.ts导出
4. 在CLI中添加对应的命令

### 添加新配置
1. 在config/目录中添加配置文件
2. 更新package.json中的脚本路径
3. 更新相关的导入路径

### 代码组织最佳实践
- 每个模块保持单一职责
- 使用index.ts统一导出
- 共享代码放在shared目录
- 保持导入路径的一致性

## 优势

1. **可维护性**: 清晰的模块分离和职责划分
2. **可扩展性**: 易于添加新功能和模块
3. **可读性**: 直观的目录结构和命名
4. **开发效率**: 集中的配置管理和清晰的导入路径
5. **构建优化**: 分离的构建配置支持不同的构建需求

这种结构设计确保了项目的长期可维护性和开发效率，同时保持了代码的清晰性和组织性。

## 测试与示例

### 测试目录结构

测试文件组织在 `tests/` 目录中：

```
tests/
├── integration/              # 集成测试
│   ├── image-downloader.test.js
│   └── title-validation.test.js
└── fixtures/                 # 测试数据
    └── Bert.jpg
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行单个测试
npm run test:image-downloader
npm run test:title-validation

# 手动运行
node tests/integration/image-downloader.test.js
node tests/integration/title-validation.test.js
```

### 示例目录结构

示例文件组织在 `examples/` 目录中：

```
examples/
├── images/                   # 示例图片
│   ├── circle.png/svg
│   ├── geometric.png/svg
│   └── wave.png/svg
└── README.md                 # 使用示例
```

### 核心功能模块

#### 1. 图片下载器 (`image-downloader.ts`)

处理图片 URL 的自动下载和缓存功能。

**主要特性**：
- URL 识别和下载
- 智能缓存（SHA256 哈希）
- 格式验证（JPEG, PNG, GIF, WebP, BMP）
- 混合路径支持

**使用示例**：
```typescript
import { ImageDownloader } from '../../shared/image-downloader';

const downloader = new ImageDownloader('./temp_images');
const result = await downloader.downloadImage('https://example.com/image.jpg');
```

#### 2. 标题验证器 (`title-validator.ts`)

精确的标题宽度验证，符合小红书显示规则。

**主要特性**：
- CJK 字符（中/日/韩）：2 单位
- ASCII 字符（英文/数字）：1 单位
- Emoji 处理
- 智能截断

**使用示例**：
```typescript
import { validateTitleWidth } from '../../shared/title-validator';

const result = validateTitleWidth('Hello世界');
console.log(result.valid); // true
console.log(result.width);  // 10 units
```
