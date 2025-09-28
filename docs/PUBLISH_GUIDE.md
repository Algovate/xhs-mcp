---
noteId: "7044e1c09c2911f0b640cb02e74e4a0a"
tags: []

---

# 📦 NPM 发布指南

## 🚀 发布流程

### 1. 发布前检查

```bash
# 运行预发布检查脚本
node scripts/pre-publish-check.js

# 或手动检查
npm run build
npm run lint
npm run format:check
```

### 2. 版本管理

```bash
# 查看当前版本
npm version

# 更新版本号
npm version patch   # 0.6.0 → 0.6.1 (bug修复)
npm version minor   # 0.6.0 → 0.7.0 (新功能)
npm version major   # 0.6.0 → 1.0.0 (重大变更)

# 预发布版本
npm version prerelease --preid=beta  # 0.6.0 → 0.6.1-beta.0
npm version prerelease --preid=alpha # 0.6.0 → 0.6.1-alpha.0
```

### 3. 发布到 NPM

#### 首次发布
```bash
# 登录 NPM (如果未登录)
npm login

# 发布到 NPM
npm publish
```

#### 预发布版本
```bash
# 发布 beta 版本
npm publish --tag beta

# 发布 alpha 版本
npm publish --tag alpha
```

#### 发布特定版本
```bash
# 发布特定版本
npm publish 0.6.1

# 发布并打标签
npm publish --tag latest
```

### 4. 发布后验证

```bash
# 验证包已发布
npm view xhs-mcp

# 测试安装
npx xhs-mcp --help

# 检查版本
npm view xhs-mcp version
```

## 📋 发布检查清单

### 发布前
- [ ] 代码构建成功 (`npm run build`)
- [ ] 代码质量检查通过 (`npm run lint`)
- [ ] 代码格式检查通过 (`npm run format:check`)
- [ ] 所有测试通过 (如果有)
- [ ] 版本号已更新
- [ ] CHANGELOG.md 已更新
- [ ] README.md 文档完整
- [ ] package.json 元数据完整

### 发布中
- [ ] 已登录 NPM (`npm whoami`)
- [ ] 选择正确的发布标签
- [ ] 确认发布范围 (public/private)

### 发布后
- [ ] 验证包在 NPM 上可见
- [ ] 测试安装和运行
- [ ] 更新 GitHub 标签
- [ ] 通知用户新版本

## 🔄 自动化发布 (推荐)

### 使用 npm version 脚本
```bash
# 自动构建、提交、打标签
npm version patch
# 这会自动运行:
# 1. npm run build
# 2. git add -A dist
# 3. git commit -m "v0.6.1"
# 4. git tag v0.6.1
# 5. git push && git push --tags
```

### 使用 GitHub Actions (可选)
创建 `.github/workflows/publish.yml` 实现自动发布。

## ⚠️ 注意事项

1. **版本冲突**: 确保版本号唯一，不能重复发布
2. **标签管理**: 使用 `--tag` 参数管理发布渠道
3. **权限检查**: 确保有包的发布权限
4. **回滚策略**: 如果发布有问题，可以发布补丁版本
5. **文档同步**: 发布后及时更新文档和示例

## 🏷️ 版本标签说明

- `latest`: 默认标签，稳定版本
- `beta`: 测试版本，功能完整但可能有bug
- `alpha`: 早期版本，功能可能不完整
- `next`: 下一个主要版本的预览

## 📊 发布监控

发布后可以通过以下方式监控：
- NPM 下载统计: https://www.npmjs.com/package/xhs-mcp
- GitHub 发布页面: https://github.com/algovate/xhs-mcp/releases
- 用户反馈: Issues 和 Discussions
