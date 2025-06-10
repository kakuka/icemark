<div align="center">
<sub>

[English](../../README.md) • 简体中文

</sub>
</div>
<br>
<div align="center">
  <h1>Icemark</h1>
  <p align="center">
  <img src="../../assets/icons/icemark-logo.png" width="30%" />
  </p>
  <p>Icemark，产品经理的AI Agent</p>
</div>
<br>
<br>

**Icemark** 是一个专门面向产品经理的AI Agent，不仅具备市场调研、PRD编写、原型设计等专用能力，也具备高级辅助等通用能力，能够帮助产品经理应对日常各种工作挑战。

Icemark主要包括两个部分：

1. **Icemark Agent** - 一个VSCode扩展插件，执行任务的主体。
2. **Icemark MCP** - 工具箱，为Icemark Agent提供网络搜索、页面内容提取、知乎、小红书、微博搜索，以及语言风格管理、语料管理等工具。

## ✨ Assistant-Max模式

特别要介绍的是**Assistant-Max模式** - 这是一个高级认知迭代工作模式，专注于长期、复杂任务的管理与执行，比如：

- 写小说
- 市场调研，公司研究
- 针对特定主题的深度分析

基本只要是信息处理类的任务，它都能够胜任。

它在开始任务前，会制定详细的计划，并和你确认，你可以进行纠正。同时，它还具备任务中断和恢复能力，你可以随时停止，在有新材料、新思路时，同步给它再继续运行。

这其实是我们日常工作的常态——确定初步的目标和计划，执行中对目标的理解逐渐加深，逐步修改&调整计划，迭代升级，最终完成任务。

**注意**: 这个模式对token的消耗量非常大，测试时最好找到一些低成本的模型（推荐OpenRouter的免费DeepSeek R1）。当然，模型越好，它的效果越好。

## 🔧 核心功能

- **市场调研**: 全面的市场分析和竞品研究
- **PRD编写**: 专业的产品需求文档创建
- **原型设计**: 快速原型制作和设计迭代
- **高级辅助**: 通用AI能力满足各种任务需求
- **自然语言交互**: 使用日常语言进行沟通
- **文件操作**: 直接在您的工作区中读取和写入文件
- **终端命令**: 必要时执行系统命令
- **可自定义模式**: 针对不同任务定制的专业角色
- **MCP集成**: 不仅支持Icemark MCP，也支持社区MCP

## 🛠 技术基础

Icemark基于**Roo Code 1.5.5**开发，主要调整包括：

1. **模式适配**: 增加PRD、Prototype等产品经理所需模式，令其更符合产品经理的需求
2. **配套MCP**: 提供了配套MCP，大大增强了实际工作处理能力
3. **streamableHttp协议支持**: 增加了对streamableHttp协议的支持，加强了Agent和MCP之间的协同稳定性和效率

## 📖 使用说明

### 1. 下载与安装

Icemark包含两个部分：Agent（VSCode扩展）和MCP（工具箱）。

#### 1.1 Agent安装

Agent是一个VSCode扩展，有两种安装方式：

首先，打开VSCode的扩展市场（打开VSCode后，`Ctrl+Shift+X`即可打开）。

**方式一：直接搜索**
- 搜索"Icemark"即可找到
- 点击扩展，然后在详情页面点击安装

**方式二：通过VSIX安装**  
- 首先在指定链接中下载VSIX文件，链接地址：https://github.com/kakuka/icemark/releases/download/v1.0/icemark-agent.vsix
- 然后在扩展市场的管理面板中点击"Install from VSIX"

<img src="../../assets/images/install-from-vsix.png" width="100%" />


#### 1.2 MCP安装

根据操作系统选择对应版本：
- **Mac电脑**: 下载Mac版本软件，链接地址：https://github.com/kakuka/icemark/releases/download/v1.0/Icemark.MCP-1.0.3-universal.dmg
- **Windows电脑**: 下载Windows版本软件，链接地址：https://github.com/kakuka/icemark/releases/download/v1.0/Icemark.MCP.Setup.1.0.3.exe

**⚠️ 安全提示处理**

由于Icemark没有进行代码签名，操作系统会进行安全提示：

- **Mac**: 参考 [Apple官方指南](https://support.apple.com/en-hk/guide/mac-help/mh40616/mac)
- **Windows**: Windows11通过SmartScreen进行拦截，点击"运行"即可

### 2. 配置设置

#### 2.1 配置大模型API密钥

在Icemark Agent中配置大模型提供商的API密钥：
- 软件中有配置引导
- 按照引导步骤配置即可

#### 2.2 配置Agent与MCP连接

**第一步：确保Icemark MCP运行**

启动Icemark MCP后，在帮助页面中找到配置信息，类似如下：

```json
"icemark-mcp-streamable": {
  "autoApprove": [],
  "disabled": false,
  "timeout": 600,
  "url": "http://localhost:54321/mcp",
  "transportType": "streamableHttp",
  "alwaysAllow": []
}
```

> 📝 **注意**: 默认情况下Icemark MCP在54321端口运行，如果该端口被占用，会自动选择其他端口。

**第二步：在Agent中添加MCP配置**

1. 拷贝上述配置信息
2. 打开Icemark Agent的MCP管理板块（顶部工具栏）
3. 点击"MCP servers"按钮
4. 点击"编辑全局配置"
5. 将配置信息拷贝进去并保存


<img src="../../assets/images/mcp-setup.png" width="30%" />


最终配置效果：

```json
{
  "mcpServers": {
    "icemark-mcp-streamable": {
      "autoApprove": [],
      "disabled": false,
      "timeout": 600,
      "url": "http://localhost:54321/mcp",
      "transportType": "streamableHttp",
      "alwaysAllow": []
    }
  }
}
```

**第三步：确认连接状态**

确认链接状态，必要时可以点击重连按钮。

<img src="../../assets/images/mcp-server-status.png" width="50%" />


#### 2.3 Icemark MCP配置（可选）

在Icemark MCP的配置页面进行以下设置：

**目标网站登录**
- 用于从需要登录的网站获取信息
- 根据提示输入目标网站地址并登录
- Icemark MCP内置浏览器会保存登录信息
- 登录会过期，需要定期重新登录
- 适用于知乎搜索、小红书搜索、微博搜索等

**配置语言风格**
- 提供特定语言风格的语料
- 在使用时告诉Icemark Agent利用MCP工具
- 可生成特定风格内容（如金庸风格、韩寒风格等）

### 3. 开始使用

配置完成后即可开始使用：

1. **选择合适的模式**: 点击对话框左下角进行切换
2. **建议从基础模式开始**: 可以从最基础的Assistant模式开始尝试
3. **使用自定义模式**: 熟悉后可使用自定义模式的高级功能

<img src="../../assets/images/mode-selection.png" width="50%" />


> 💡 **进阶提示**: 自定义模式的详细说明可参考 [Roo-code文档](https://docs.roocode.com/features/custom-modes)



---


## 免责声明

**请注意**，Icemark, Inc. **不**对任何与 Icemark、任何相关的第三方工具或任何由此产生的输出相关的代码、模型或其他工具作任何陈述或保证。您承担与使用任何此类工具或输出相关的所有风险；此类工具均按"**现状**"和"**现有**"基础提供。此类风险可能包括但不限于知识产权侵权、网络漏洞或攻击、偏见、不准确、错误、缺陷、病毒、停机、财产损失或损坏和/或人身伤害。您对任何此类工具或输出的使用（包括但不限于其合法性、适当性和结果）负全部责任。
