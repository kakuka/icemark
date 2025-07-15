# 为 Icemark 做贡献

我们很高兴您有兴趣为 Icemark 做贡献。无论您是修复错误、添加功能，还是改进我们的文档，每一个贡献都让 Icemark 变得更智能！为了保持我们的社区充满活力和欢迎，所有成员必须遵守我们的[行为准则](CODE_OF_CONDUCT.zh-CN.md)。


## 决定做什么

Icemark欢迎任何形式的贡献，包括但不限于提出新需求、错误报告、编写文档、开发新功能、修复bug等。

Icemark的所有开发都以issue为基础：https://github.com/kakuka/icemark/issues。


## 开发设置

1. **克隆**仓库：

```sh
git clone https://github.com/kakuka/icemark.git
```

2. **安装依赖**：

```sh
npm run install:all
```

3. **调试**：
   在 VSCode 中按 `F5`（或**运行** → **开始调试**）打开一个加载了 Icemark 的新会话。

对 webview 的更改将立即显示。对核心扩展的更改将需要重新启动扩展主机。

或者，您可以构建一个 .vsix 文件并直接在 VSCode 中安装：

```sh
npm run build
```

`bin/` 目录中将出现一个 `.vsix` 文件，可以用以下命令安装：

```sh
code --install-extension bin/icemark-agent-<version>.vsix
```

## 编写和提交代码

任何人都可以为 Icemark 贡献代码，但我们要求您遵循这些指导方针，以确保您的贡献能够顺利集成：

1. **保持 Pull Requests 聚焦**

    - 将 PR 限制在单一功能或错误修复
    - 将较大的更改分割成更小的相关 PR
    - 将更改分解为可以独立审查的逻辑提交

2. **代码质量**

    - 在提交之前解决任何 ESLint 警告或错误

3. **测试**

    - 为新功能添加测试
    - 运行 `npm test` 确保所有测试通过
    - 如果您的更改影响现有测试，请更新它们
    - 在适当的情况下包括单元测试和集成测试

4. **提交指南**

    - 编写清晰、描述性的提交消息
    - 在提交中使用 #issue-number 引用相关问题

5. **提交前**

    - 在最新的 main 分支上变基您的分支
    - 确保您的分支成功构建
    - 再次检查所有测试是否通过
    - 检查您的更改中是否有任何调试代码或控制台日志

6. **Pull Request 描述**
    - 清晰描述您的更改做了什么
    - 包括测试更改的步骤
    - 列出任何破坏性更改
    - 为 UI 更改添加截图

## 贡献协议

通过提交 pull request，您同意您的贡献将在与项目相同的许可下获得许可（[Apache 2.0](../LICENSE)）。
