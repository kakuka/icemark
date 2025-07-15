# Git 工作流与分支规范指南（Issue驱动版）

## 🚀 核心理念

**Issue驱动开发**：所有代码变更都必须从 Issue 开始，确保每次修改都有明确的目标和追踪记录。

## 📊 分支管理策略

### 🌳 三种分支类型

| 分支类型 | 数量 | 生命周期 | 用途 |
|----------|------|----------|------|
| **main** | 1个 | 永久 | 稳定的主分支，持续演进 |
| **release-\*** | 每个release-issue一个 | 长期保留 | 版本发布管理，集成测试 |
| **feat/fix/docs-\*** | 每个issue一个 | 合并后删除 | 功能开发、Bug修复 |

### 🎯 分支命名规范

```
main                           # 主分支
release/v1.2.0                 # release分支，对应release-issue
feat/123-login-form            # 功能分支，对应issue #123
fix/456-memory-leak            # 修复分支，对应issue #456
docs/789-api-update            # 文档分支，对应issue #789
```

## 📝 Issue 管理

### Issue 类型

| 类型 | Label | 说明 | 示例 |
|------|-------|------|------|
| **feat** | `enhancement` | 新功能开发 | `feat/123-login-form` |
| **fix** | `bug` | Bug 修复 | `fix/456-fix-login-error` |
| **docs** | `documentation` | 文档修改 | `docs/789-update-readme` |
| **refactor** | `refactor` | 代码重构与格式优化（不改功能） | `refactor/321-optimize-auth` |
| **chore** | `chore` | 构建配置、依赖等杂项任务（非功能改动） | `chore/654-ci-update` |
| **release** | `release` | 版本发布规划 | v1.2.0 版本发布 |

### Release Issue 规划

**Release Issue** 是特殊的 Issue，用于管理版本发布：

```markdown
# Release v1.2.0

## 📋 包含功能
- [ ] #123 用户认证功能
- [ ] #124 数据导出功能  
- [ ] #125 性能优化

## 🐛 包含修复
- [ ] #456 内存泄漏修复
- [ ] #457 UI显示问题

## 📚 包含文档
- [ ] #789 API文档更新

## 🎯 发布目标
- 预计发布时间：2024-02-01
- 主要特性：用户认证、数据导出
```

## 🛠️ 自动化工具

项目提供了 `icemark-action` 自动化脚本，简化常用Git操作：

### 快速命令

```bash
# 创建开发分支
npm run icemark-action new-branch feat 123 login-form

# 创建release分支  
npm run icemark-action new-branch release v1.2.0

# 清理开发分支（远程+本地）
npm run icemark-action clear-dev-branch

# 清理release分支（仅本地）
npm run icemark-action clear-release-branch

# 发布（打标签）
npm run icemark-action release v1.2.0

# 查看帮助
npm run icemark-action help
```

### 🔧 脚本功能详解

#### new-branch - 创建分支
```bash
# 创建开发分支
npm run icemark-action new-branch feat 123 login-form
# 等价于：
# git checkout main && git pull origin main && git checkout -b feat/123-login-form

# 创建release分支
npm run icemark-action new-branch release v1.2.0
# 等价于：
# git checkout main && git pull origin main && git checkout -b release/v1.2.0
```

#### clear-dev-branch - 清理开发分支
```bash
# 删除当前分支（自动检测）
npm run icemark-action clear-dev-branch

# 删除指定分支
npm run icemark-action clear-dev-branch feat/123-login-form

# 执行步骤：
# 1. 先删除远程分支（避免main分支push限制）
# 2. 切换到main分支
# 3. 拉取最新main代码
# 4. 删除本地分支
```

#### clear-release-branch - 清理Release分支
```bash
# 删除当前release分支（仅本地）
npm run icemark-action clear-release-branch

# 删除指定release分支（仅本地）
npm run icemark-action clear-release-branch release/v1.2.0

# 注意：远程release分支保留作备份
```

#### release - 发布标签
```bash
# 在当前release分支创建并推送标签
npm run icemark-action release v1.2.0

# 执行步骤：
# 1. 检查当前是否在release分支
# 2. 检查标签是否已存在
# 3. 创建标签
# 4. 推送标签到远程
```

### ⚠️ 注意事项

1. **分支名称自动格式化**：脚本会自动处理分支命名格式，无需手动添加`/`
2. **安全确认**：删除操作会要求用户确认，避免误操作
3. **智能检测**：脚本会检测分支类型和当前状态，防止错误操作
4. **Husky兼容**：考虑了Husky配置限制，避免在main分支执行受限操作
5. **错误处理**：提供清晰的错误信息和使用建议

## 🔄 开发工作流

### 1. Issue创建与规划

```bash
# 1. 创建普通Issue（功能/修复/文档）
# 2. 创建或关联到对应的Release Issue
# 3. 在Release Issue中添加依赖关系
```

### 2. 开发分支流程

#### 🚀 使用自动化工具（推荐）

```bash
# Step 1: 创建开发分支
npm run icemark-action new-branch feat 123 login-form

# Step 2-4: 正常开发、提交、推送、创建PR
git add .
git commit -m "feat: implement user authentication"
git push -u origin feat/123-login-form

# Step 5-6: PR合并后清理分支
npm run icemark-action clear-dev-branch
```

#### 📝 手动操作方式

```bash
# Step 1: 从main创建开发分支
git checkout main
git pull origin main
git checkout -b feat/123-login-form

# Step 2: 开发提交
git add .
git commit -m "feat: implement user authentication"

# Step 3: 推送分支
git push -u origin feat/123-login-form

# Step 4: 创建PR
# - 标题：feat: implement user authentication
# - 描述：Closes #123
# - 关联到对应的Release Issue

# Step 5: 代码审查和合并
# Step 6: 删除开发分支
git push origin --delete feat/123-login-form
git checkout main && git pull
git branch -d feat/123-login-form
```

### 3. Release分支流程

#### 🚀 使用自动化工具（推荐）

```bash
# Step 1: 创建Release分支
npm run icemark-action new-branch release v1.2.0

# Step 2-4: 集成测试、准备发布材料、提交
# - 运行完整测试套件、集成测试、修复问题
# - 更新package.json版本号、CHANGELOG.md、文档
git add .
git commit -m "chore: prepare for v1.2.0 release"

# Step 5: 构建和发布
npm run vsix  # 生成.vsix文件
# 手动测试.vsix文件、发布到VS Code Marketplace

# Step 6-7: 打标签发布
npm run icemark-action release v1.2.0

# Step 8-9: 创建PR合并到main，保留release分支
# 创建PR: release/v1.2.0 → main
# 标题：Release v1.2.0，描述：Closes #[release-issue-number]
```

#### 📝 手动操作方式

```bash
# Step 1: 创建Release分支（当Release Issue中的功能基本完成时）
git checkout main
git pull origin main
git checkout -b release/v1.2.0

# Step 2: 集成测试和调试
# - 运行完整测试套件
# - 进行集成测试
# - 修复发现的问题

# Step 3: 准备发布材料
# - 更新package.json版本号
# - 生成/更新CHANGELOG.md
# - 更新文档
# - 运行最终构建测试

# Step 4: 提交发布准备
git add .
git commit -m "chore: prepare for v1.2.0 release"

# Step 5: 构建和发布
npm run vsix  # 生成.vsix文件
# 手动测试.vsix文件
# 发布到VS Code Marketplace

# Step 6: 创建发布PR
# 创建PR: release/v1.2.0 → main
# 标题：Release v1.2.0
# 描述：Closes #[release-issue-number]

# Step 7: 在release分支打标签
git tag v1.2.0
git push origin v1.2.0

# Step 8: 合并到main分支
# 合并PR后，main分支自动同步release分支的内容和标签

# Step 9: 保留release分支（不删除）
# release分支作为该版本的备份保留
```

## 🏷️ 提交规范

### Commit Message 格式

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### 类型说明

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(auth): add user login` |
| `fix` | Bug修复 | `fix(ui): resolve button alignment` |
| `docs` | 文档更新 | `docs(api): update authentication guide` |
| `refactor` | 代码重构 | `refactor(db): optimize query performance` |
| `test` | 测试相关 | `test(auth): add login unit tests` |
| `chore` | 构建/工具 | `chore: update dependencies` |
| `style` | 代码格式 | `style: fix ESLint warnings` |

## 📦 发布流程详解

### Phase 1: 准备阶段
1. ✅ 确认Release Issue中所有功能已完成
2. ✅ 创建release分支
3. ✅ 运行完整测试套件
4. ✅ 进行集成测试

### Phase 2: 发布准备
1. ✅ 更新版本号（package.json）
2. ✅ 生成CHANGELOG.md
3. ✅ 更新相关文档
4. ✅ 构建.vsix文件
5. ✅ 本地安装测试

### Phase 3: 发布执行
1. ✅ 发布到VS Code Marketplace
2. ✅ 创建GitHub Release
3. ✅ 上传.vsix到Release附件
4. ✅ 更新README徽章等

### Phase 4: 标签与合并
1. ✅ 在release分支创建Git标签
2. ✅ 推送标签到远程
3. ✅ 创建release → main的PR
4. ✅ 合并到main分支
5. ✅ 保留release分支作备份

## 🔧 分支保护规则

### main分支保护
- ✅ 禁止直接推送
- ✅ 要求PR审查
- ✅ 要求状态检查通过
- ✅ 要求分支是最新的

### release分支保护  
- ✅ 仅发布管理员可直接推送
- ✅ 集成测试必须通过
- ✅ 构建验证必须成功

## 🛠️ Husky配置说明

### 分支类型检测逻辑
- **main分支**：禁止直接提交和推送
- **开发分支**（feat/*, fix/*, docs/*, refactor/*, chore/*）：跳过所有检测，提高开发效率
- **release分支**（release/*）：执行完整检测，确保发布质量

### pre-commit检查
```bash
# Main分支：禁止提交
# 开发分支：跳过检测
# Release分支：执行以下检查
# 1. 生成类型文件
# 2. 检查代码格式（lint-staged）
# 3. 验证类型文件变更
```

### pre-push检查
```bash
# Main分支：禁止推送
# 开发分支：跳过检测
# Release分支：执行以下检查
# 1. 运行编译检查
# 2. 检查是否有changeset文件
```

## 🔍 常见问题解决

### Q1: 如何关联开发分支到Release Issue？
**A**: 在Release Issue描述中添加依赖关系，如：
```markdown
## 包含功能
- [ ] #123 用户认证功能 (feat/123-login-form)
```

### Q2: release分支什么时候创建？
**A**: 当Release Issue中70-80%的功能已在main分支完成时创建。

### Q3: 如果release测试发现问题怎么办？
**A**: 
1. 在release分支直接修复小问题
2. 重大问题回到开发分支修复后合并到main，再同步到release分支

### Q4: 多个release并行开发怎么处理？
**A**: 
1. 创建不同的release分支
2. 开发分支明确关联到对应release
3. 按优先级顺序发布

## 📊 工作流可视化

```
main ←--------← release/v1.2.0 ←------ (发布完成后合并)
 ↑                    ↑
 ├── feat/123 --------┘  (集成测试)
 ├── fix/456  --------┘
 └── docs/789 --------┘

Issue #123 → feat/123-login-form → PR → main → release/v1.2.0 → 测试 → 发布 → main
```

## 🎯 最佳实践

1. **使用自动化工具**：优先使用 `icemark-action` 脚本提高操作效率
2. **小步快跑**：每个Issue保持适中的工作量（1-3天完成）
3. **及时同步**：开发分支定期从main同步最新代码
4. **充分测试**：release分支必须经过完整测试
5. **文档同步**：功能开发时同步更新相关文档
6. **版本规划**：提前规划release内容，避免临时调整
7. **备份保留**：release分支作为版本快照永久保留
8. **命令确认**：自动化工具会要求确认危险操作，认真阅读提示

## 📋 检查清单

### 开发分支检查清单
- [ ] 从最新main分支创建
- [ ] 分支名称符合规范
- [ ] commit message符合规范
- [ ] 代码通过所有检查
- [ ] PR正确关联Issue
- [ ] 代码审查通过

### Release分支检查清单
- [ ] 所有计划功能已在main分支
- [ ] 集成测试通过
- [ ] 版本号已更新
- [ ] CHANGELOG已生成
- [ ] 文档已更新
- [ ] .vsix文件构建成功
- [ ] 本地安装测试通过
- [ ] Git标签已在release分支创建
- [ ] 标签已推送到远程
- [ ] Marketplace发布成功
- [ ] GitHub Release创建
- [ ] main分支已合并

---

*这套流程确保了代码质量、发布稳定性和项目的可追溯性。*
