# Icemark English Documentation

**Navigation:**

- website: [icemark.tech](https://icemark.tech)
- GitHub: [https://github.com/kakuka/icemark](https://github.com/kakuka/icemark)
- [中文](https://github.com/kakuka/icemark/blob/main/README.zh-CN.md)

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

**Icemark** is an AI Agent for Product Managers, providing not only specialized capabilities like market research, PRD writing, and prototype design, but also general assistance capabilities to help product managers handle various daily work challenges.

<div align="center">
  <img src="assets/images/excalidraw-to-prototype-8x.gif" width="100%" alt="prototype" />
</div>

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

**✨ Core Advantages**: Icemark provides numerous basic tools, such as:

- Internet search, including Bing, Baidu, Sogou, and DuckDuckGo
- Web information extraction and conversion to Markdown
- Social platform search, such as Zhihu, Xiaohongshu, Weibo, etc.

With Icemark, you no longer need other similar paid MCP services, providing one-stop solutions for common problems.

## 🎞️ Demo Video

### Turn Hand-Drawn Sketches into Interactive Prototypes

Integrated with Excalidraw to support hand-drawn wireframes and generate interactive prototypes.
[https://www.youtube.com/watch?v=gAQMNN-qMpk](https://www.youtube.com/watch?v=gAQMNN-qMpk)

[![Demo Video](https://img.youtube.com/vi/gAQMNN-qMpk/hqdefault.jpg)](https://www.youtube.com/watch?v=gAQMNN-qMpk)

### Product Analysis

Built-in Xiaohongshu browsing feature, enables comparison and analysis of different products based on Xiaohongshu content, generating visual reports with text and images.
[https://www.youtube.com/watch?v=LRmbJNd4Np4](https://www.youtube.com/watch?v=LRmbJNd4Np4)

[![Demo Video](https://img.youtube.com/vi/LRmbJNd4Np4/hqdefault.jpg)](https://youtu.be/LRmbJNd4Np4)

## 📥 Download & Installation

<div align="center">
  <img src="assets/images/setup-marketplace.gif" width="100%" alt="setup" />
</div>

### 💻 Main Interface

<div align="center">
  <img src="assets/images/icemark-in-vscode-en.png" width="100%" alt="Icemark in vscode" />
</div>

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

- First download the VSIX file
    > On the GitHub Releases page [https://github.com/kakuka/icemark/releases/](https://github.com/kakuka/icemark/releases/), find the latest release. Then, under the `Assets` section, locate icemark-agent-[version].vsix (for example, icemark-agent-1.2.6.vsix) and click to download. You can also download it from website: [https://icemark.tech/](https://icemark.tech/).
- Launch VSCode and open the extension marketplace (`Ctrl+Shift+X`)
- Click "**Install from VSIX**" in the extension marketplace management panel

<div align="center">
  <img src="assets/images/install-from-vsix.png" width="80%" alt="Install from VSIX" />
</div>

After installation is complete, click the Icemark icon in the left sidebar.

> Icon location: The `entry` position shown in the main interface image above.

## ⚙️ Initial Configuration

Icemark supports multiple LLM providers, which can be configured according to your preferences.

### 🔑 Configure API Keys

When Icemark starts, you will see relevant prompts. Simply follow the instructions to configure.

For Chinese users, we recommend using DeepSeek: https://www.deepseek.com/

- After registering an account, obtain the API key at: https://platform.deepseek.com/
- Fill this key into Icemark's model configuration.
- Select Model and save.

<div align="center">
  <img src="assets/images/deepseek-config.png" width="60%" alt="Configure DeepSeek" />
</div>

For providers like Alibaba Cloud, ByteDance's Volcano Engine, etc., you can choose `OpenAI Compatible`:

**Required configuration parameters:**

| Parameter | Description       | How to Obtain                            |
| --------- | ----------------- | ---------------------------------------- |
| Base URL  | API base URL      | Obtain from large model service provider |
| API Key   | Access key        | Obtain from large model service provider |
| Model     | Model name to use | Obtain from large model service provider |

<div align="center">
  <img src="assets/images/configLLM.png" width="60%" alt="Configure Large Model" />
</div>

You can add other providers or adjust existing configurations later.

> Location: The `LLM Config` configuration shown in the main interface image above.

## Install and config video

[https://www.youtube.com/watch?v=rH7K5lilpV4](https://www.youtube.com/watch?v=rH7K5lilpV4)

[![Watch the Demo](https://img.youtube.com/vi/rH7K5lilpV4/hqdefault.jpg)](https://www.youtube.com/watch?v=rH7K5lilpV4)

### 🎯 Getting Started

After completing the initial configuration, you can use Icemark's various capabilities. We recommend starting with **Icemark mode**.

<div align="center">
  <img src="assets/images/modes.png" width="60%" alt="Select Mode" />
</div>

---

Now, you should be able to handle many tasks through Icemark. If you're already familiar with Icemark, we recommend trying the advanced features.

## 🚀 Advanced Usage

Icemark provides custom modes to help you further improve work efficiency:

### 🛠️ Custom Modes

Custom modes allow you to extend Icemark's capabilities or customize working mechanisms that better match your work. It's definitely worth trying.

**📖 Reference Documentation:**

- [modes](https://github.com/kakuka/icemark/blob/main/docs/en/modes.md)

---

## 🛠️ Technical Foundation

Icemark is built on **RooCode 3.5.5**.

## 📬 Contact Us

If you have any questions or suggestions, feel free to contact us at <icemark.tech@gmail.com>

---

## ⚖️ Disclaimer

**Please note** that Icemark, Inc **does not** make any representations or warranties regarding any code, models, or other tools provided or made available in connection with Icemark, any associated third-party tools, or any resulting outputs. You assume **all risks** associated with the use of any such tools or outputs; such tools are provided on an **"AS IS"** and **"AS AVAILABLE"** basis. Such risks may include, without limitation, intellectual property infringement, cyber vulnerabilities or attacks, bias, inaccuracies, errors, defects, viruses, downtime, property loss or damage, and/or personal injury. You are solely responsible for your use of any such tools or outputs (including, without limitation, the legality, appropriateness, and results thereof).
