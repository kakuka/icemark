import { ToolArgs } from "./types"

export function getPrototypeDescription(args: ToolArgs): string {
	return `# prototype

## 定位

prototype工具主要解决两类问题：

### 第一类：HTML原型的初始化问题

如果要使用HTML技术创建原型，首先需要创建项目相关文件夹并准备必要的资源文件，这是一个比较复杂的过程，必须通过prototype工具完成，它能够创建标准原型项目文件夹并准备Icemark所有项目中一致的资源。

文件夹命名必须以 \`-html-web\` 或 \`-html-mobile\` 结尾，以表示是web还是mobile平台。

**例子：**

<prototype>
<action>init</action>
<path>dashboard-html-web</path>
</prototype>

**该例子的预期结果：**
系统会自动创建 \`dashboard-html-web/\` 文件夹，包含以下标准结构：
- \`assets/\` - 内置资源目录（Bootstrap、AlpineJS、Lucide等）
- \`images/\` - 图片目录
- \`screenshots/\` - 截图目录
- \`index.html\` - 入口文件

**成功后，应该：**
文件夹结构已准备完毕，可以直接在 \`index.html\` 中开始编写原型代码，无需手动引入任何外部资源。你可以创建任何需要的其他页面，但要遵循以下规则：
- 页面必须放在 \`index.html\` 同级目录下
- 页面必须以 \`.html\` 结尾，且命名必须使用代表其意义的英文单词	
- 如果需要js或css等资源，必须优先使用assets目录中的内置资源，不要引入网络资源。


### 第二类：非文本文件的可视化渲染问题

目前包括HTML、Excalidraw和Mermaid三大类，这些文件需要专门的渲染引擎才能正常显示。

**用法：**

**HTML原型渲染：**
<prototype>
<action>show</action>
<path>dashboard-html-web</path>
</prototype>

注：path指向文件夹，不指向页面。

**Excalidraw图表渲染：**
<prototype>
<action>show</action>
<path>workflow.excalidraw</path>
</prototype>

**Mermaid图表渲染：**
<prototype>
<action>show</action>
<path>system.mmd</path>
</prototype>

## 参数

- **action**: （必需）两种取值：
  - "init" - 初始化/创建原型文件或项目
  - "show" - 显示/渲染已存在的原型文件
- **path**: （必需）原型文件的路径（当前工作区${args.cwd}下的相对路径）

注：path是当前工作区的相对路径，你的文件可能在工作区根目录下，也可能在工作区的子目录下，所以可能是\`some-dir/dashboard-html-web\`，也可能是\`dashboard-html-web\`。

## 路径规则及自动识别

系统根据路径后缀自动识别原型类型：

- **Mermaid图表**: \`xxx.mmd\` (文件)
- **Excalidraw图表**: \`xxx.excalidraw\` 或 \`xxx.excalidraw.json\` (文件)
- **HTML Web原型**: \`xxx-html-web\` (文件夹)
- **HTML Mobile原型**: \`xxx-html-mobile\` (文件夹)

## 说明及限制

### HTML原型限制
- **命名规则严格**：必须以 \`-html-web\` 或 \`-html-mobile\` 结尾
- **平台区分**：web和mobile使用不同的viewport设置
- **资源限制**：只能使用内置assets资源，禁止引入网络资源
- **目录结构**：必须遵循标准的 \`assets/\`、\`images/\`、\`index.html\` 结构

### 文件操作限制
- **路径规范**：所有路径必须是当前工作区的相对路径
- **类型识别**：完全依赖文件名/路径后缀进行自动识别
- **action限制**：只支持 init 和 show 两种操作
- ***图片处理**：如果在创建html原型过程中用户指定了图片，必须先拷贝到images文件夹，再引用。

### 内置资源说明
HTML原型的assets目录已预置以下资源：
- Bootstrap CSS框架
- AlpineJS JavaScript框架
- Lucide图标库
- 其他Icemark标准资源

请优先使用这些内置资源，确保原型的一致性和可靠性。

`
}
