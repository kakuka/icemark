**Navigation:**
- [🌐 Website](https://icemark.tech)
- [📖 Documentation](https://github.com/kakuka/icemark/blob/main/pages/index.md)
- [🇨🇳 中文](https://gitee.com/kakuka1988/icemark)

---
<br>
<div align="center">
  <h1>Icemark</h1>
  <p align="center">
    <img src="assets/icons/icemark-logo.png" width="30%" alt="Icemark Logo" />
  </p>
  <p><strong>Icemark, AI Agent for Product Managers</strong></p>
</div>
<br>

## 📋 Product Overview

**Icemark** is an AI Agent specifically designed for Product Managers, providing both specialized capabilities like market research, PRD writing, and prototype design, as well as general advanced assistance capabilities to help product managers handle various daily work challenges.

## ⭐ Main Features

Icemark provides four core working modes, each deeply optimized for specific work scenarios of product managers:

### 1️⃣ General Assistant **Icemark Mode**

This is a versatile AI assistant with comprehensive capabilities including planning, analysis, execution, problem-solving, and research. Through the intelligent Task Manifest document management system, it can handle complex multi-step projects, support task interruption and resumption, ensuring work continuity and controllability. Whether for daily work assistance or complex project management, it provides professional support.

### 2️⃣ Market Analysis **Market Mode**

An elite-level analysis assistant specifically designed for market research and competitive analysis. Utilizing professional analysis frameworks such as SWOT analysis, PESTEL analysis, Porter's Five Forces model, and market segmentation strategies, combined with real-time data search and deep content extraction capabilities, it generates structured multi-dimensional market analysis reports. Helps product managers deeply understand market environments and seize business opportunities.

### 3️⃣ PRD Writing **PRD Mode**

A professional requirements analysis assistant based on user stories, JTBD (Jobs-to-be-Done) theory, and the three-question method. Through systematic requirement mining methods, it deeply understands users' real needs, analyzes the four driving forces of user behavior (push, pull, anxiety, habits), and creates clear and complete product requirement documents, ensuring product design truly meets user needs.

### 4️⃣ Rapid Prototype Generation **Prototype Mode**

A professional product prototype creation assistant that can quickly generate HTML-format interactive prototypes based on product requirements. Supports multi-platform prototype design for Web, mobile, and desktop, providing modern UI interfaces and user-friendly interactive experiences, helping product managers quickly validate product concepts and showcase design ideas.

---

**✨ Core Advantages**: Icemark provides numerous basic tools, along with web search, web information extraction, and Markdown conversion capabilities, eliminating the need for other paid services and providing one-stop solutions for common problems.

## 🛠️ Technical Foundation

Icemark is built on **Roo Code 3.5.5**.

## 📥 Download & Installation

Icemark is a Visual Studio Code extension, with the simplest installation method being direct installation through the extension interface.

> ⚠️ **Important Note**: To use Icemark, you must first install Visual Studio Code (VSCode). Installation instructions: https://code.visualstudio.com/

After installing VSCode, there are three ways to install Icemark:

### 🔍 Method 1: Direct Search
- Launch VSCode and open the extension marketplace (`Ctrl+Shift+X`)
- Search for "**Icemark**" to find it
- Click on the extension, then click **Install** on the details page

### 🌐 Method 2: Marketplace Installation
- Open VSCode's online marketplace page: https://marketplace.visualstudio.com/items?itemName=icemark-tech.icemark-agent
- Click the **Install** button, which will automatically launch VSCode and follow the prompts for installation

> 💡 If you cannot access VSCode's online marketplace due to network issues, you can use the VSIX file for direct installation below.

### 📦 Method 3: Install via VSIX
- First download the VSIX file: https://github.com/kakuka/icemark/releases/latest/download/icemark-agent.vsix 
- Launch VSCode and open the extension marketplace (`Ctrl+Shift+X`)
- Click "**Install from VSIX**" in the extension marketplace management panel

<div align="center">
  <img src="assets/images/install-from-vsix.png" width="80%" alt="Install from VSIX" />
</div>

## ⚙️ Initial Configuration

Icemark is an AI Agent based on large language models, but it doesn't over-encapsulate or bind to any specific large model. You can choose to use your preferred large model service provider.

### 🔑 Configure API Keys

When Icemark starts, there will be relevant prompts. Follow the prompts to configure. For Alibaba Cloud, ByteDance's Volcano Engine, etc., you can choose `OpenAI Compatible`.

**Parameters to configure:**

| Parameter | Description | How to Obtain |
|-----------|-------------|---------------|
| Base URL | API base address | Obtain from large model service provider |
| API Key | Access key | Obtain from large model service provider |
| Model | Model name to use | Obtain from large model service provider |

<div align="center">
  <img src="assets/images/configLLM.png" width="60%" alt="Configure Large Model" />
</div>

### 🎯 Getting Started

After completing the initial configuration, you can use Icemark's various capabilities. We recommend starting with **Icemark mode**.

<div align="center">
  <img src="assets/images/modes.png" width="60%" alt="Select Mode" />
</div>

---

Now, you should be able to handle many tasks through Icemark. If you're already familiar with Icemark, we recommend trying the advanced features.

## 🚀 Advanced Usage

Icemark provides the following advanced features to help you further improve work efficiency:

### 🛠️ 1. Custom Modes

Custom modes allow you to extend Icemark's capabilities or customize working mechanisms that better match your work. It's definitely worth trying.

**📖 Reference Documentation:**
- 🇺🇸 English: https://github.com/kakuka/icemark/blob/main/pages/modes.md
- 🇨🇳 Chinese: https://gitee.com/kakuka1988/icemark/blob/main/pages/modes.md

### 🔧 2. Connect to MCP for More Capabilities

MCP is the Agent's toolkit. Icemark also has a matching MCP service software—**Icemark-MCP**.

Icemark-MCP not only provides basic tools like web search and content extraction, but also provides search capabilities for Zhihu, Xiaohongshu, Weibo and other community platforms, as well as more personalized services like language style management and corpus management.

#### 📥 2.1 Download & Installation

Choose the appropriate version based on your operating system:

| Operating System | Download Link |
|------------------|---------------|
| 🍎 **Mac** | [Icemark.MCP-universal.dmg](https://github.com/kakuka/icemark/releases/latest/download/Icemark.MCP-universal.dmg) |
| 🪟 **Windows** | [Icemark.MCP.Setup.exe](https://github.com/kakuka/icemark/releases/latest/download/Icemark.MCP.Setup.exe) |

**⚠️ Security Warning Handling**

Since Icemark is not code-signed, the operating system will display security warnings:

- **Mac**: Refer to [Apple's official guide](https://support.apple.com/en-hk/guide/mac-help/mh40616/mac)
- **Windows**: When Windows 11 blocks via SmartScreen, simply click "Run anyway"

#### ⚙️ 2.2 Configure MCP Connection

After MCP installation, it must be configured to match with Icemark.

**Step 1: Ensure Icemark MCP is Running**

After starting Icemark MCP, find the configuration information in the help page, similar to:

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

> 📝 **Note**: By default, Icemark MCP runs on port 54321. If this port is occupied, it will automatically select another port.

**Step 2: Add MCP Configuration in Agent**

1. Copy the above configuration information
2. Open Icemark Agent's MCP management panel (top toolbar)
3. Click "MCP servers" button
4. Click "Edit Global Configuration"
5. Paste the configuration information and save

<div align="center">
  <img src="assets/images/mcp-setup.png" width="40%" alt="MCP Configuration" />
</div>

**Final configuration result:**

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

**Step 3: Confirm Connection Status**

Verify the connection status and click the reconnect button if necessary.

<div align="center">
  <img src="assets/images/mcp-server-status.png" width="60%" alt="MCP Server Status" />
</div>

#### 🎨 2.3 Advanced Configuration

The following advanced settings can be configured in Icemark MCP's configuration page:

**🔐 Website Login**
- Used to obtain information from websites that require login
- Enter the target website address as prompted and log in
- Icemark MCP's built-in browser will save login information
- Logins expire and may need periodic re-login
- Applicable for Zhihu search, Xiaohongshu search, Weibo search, etc.

**✍️ Language Style Configuration**
- Provide corpus for specific language styles
- When using Icemark Agent, tell it to use MCP tools
- Can generate content in specific styles (e.g., Jin Yong style, Han Han style, etc.)

---

## ⚖️ Disclaimer

**Please note** that Icemark, Inc does **not** make any representations or warranties regarding any code, models, or other tools provided or made available in connection with Icemark, any associated third-party tools, or any resulting outputs. You assume **all risks** associated with the use of any such tools or outputs; such tools are provided on an **"AS IS"** and **"AS AVAILABLE"** basis. Such risks may include, without limitation, intellectual property infringement, cyber vulnerabilities or attacks, bias, inaccuracies, errors, defects, viruses, downtime, property loss or damage, and/or personal injury. You are solely responsible for your use of any such tools or outputs (including, without limitation, the legality, appropriateness, and results thereof).