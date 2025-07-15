# 搜索引擎服务架构

本文档描述了 icemark-agent-vscode 中新的搜索引擎服务架构，该架构基于 icemark-mcp 的设计思路，使用 Puppeteer 替代了 Electron BrowserWindow。

## 📋 架构概览

```
searcher/
├── GeneralSearcher.ts          # 通用搜索引擎实现
├── example.ts                  # 使用示例
├── README.md                   # 本文档
└── config/                     # 搜索引擎配置文件
    ├── base_search_engine_config.ts
    ├── bing_config.ts
    ├── baidu_config.ts
    ├── duckduckgo_config.ts
    └── sogou_config.ts
```

## 🚀 核心特性

### ✅ **真实搜索能力**
- 替代原有的 demo 数据，提供真实的搜索引擎结果
- 支持多页搜索，最多可获取 5 页结果
- 智能去重和结果过滤

### 🌐 **多搜索引擎支持**
- **Bing**: Microsoft Bing 搜索
- **百度**: 百度搜索
- **DuckDuckGo**: 隐私友好的搜索引擎
- **搜狗**: 搜狗搜索

### 🔧 **配置驱动架构**
- JavaScript 注入代码模块化
- 支持自定义请求头和 Cookie 管理
- 灵活的等待时间配置

### ⚡ **高可靠性**
- 完善的错误处理和重试机制
- 浏览器状态监控
- 自动资源清理

## 📚 使用方法

### 基础使用

```typescript
import { SearchEngineService } from "./SearchEngineService"

// 创建搜索服务实例（默认使用 Bing）
const searchService = new SearchEngineService(context, 'bing')

// 执行搜索
const results = await searchService.search(['TypeScript', 'VSCode'], 1)

console.log(`获得 ${results.length} 条搜索结果`)
results.forEach(result => {
    console.log(`${result.title} - ${result.url}`)
})
```

### 切换搜索引擎

```typescript
// 查看可用的搜索引擎
const engines = searchService.getAvailableEngines()
console.log('可用引擎:', engines) // ['bing', 'baidu', 'duckduckgo', 'sogou']

// 切换到百度搜索
searchService.switchSearchEngine('baidu')

// 执行搜索
const results = await searchService.search(['机器学习'], 1)
```

### 多页搜索

```typescript
// 搜索前3页的结果
const results = await searchService.search(['Node.js'], 3)
console.log(`总共获得 ${results.length} 条结果`)
```

### 搜索引擎信息

```typescript
// 获取搜索引擎配置信息
const info = searchService.getEngineInfo('bing')
console.log('Bing 配置:', info)
```

## 🔧 技术实现

### GeneralSearcher 类

核心搜索引擎实现，负责：

- **浏览器控制**: 使用 `BrowserSession` 管理 Puppeteer 实例
- **JavaScript 注入**: 执行配置中的 JavaScript 代码
- **结果提取**: 解析页面内容并提取搜索结果
- **翻页操作**: 自动点击下一页获取更多结果
- **错误处理**: 重试机制和异常恢复

### 配置文件结构

每个搜索引擎配置都是一个TypeScript类，直接返回BaseSearchEngineConfig实例：

```typescript
export class BingConfig {
  static getConfig(): BaseSearchEngineConfig {
    return new BaseSearchEngineConfig({
      name: 'bing_search',                    // 搜索引擎名称
      homepageUrl: 'https://www.bing.com/',  // 首页URL
      cookieDomain: 'bing.com',              // Cookie域名
      waitTimeAfterSubmit: 2000,             // 提交后等待时间
      waitTimeAfterClick: 2000,              // 点击后等待时间
      
      // JavaScript注入代码
      inputAndSubmitJs: '...',               // 输入搜索词并提交
      validatePageJs: '...',                 // 验证页面状态
      extractResultsJs: '...',               // 提取搜索结果
      clickNextPageJs: '...'                 // 点击下一页
    });
  }
}
```

## 🔄 与 icemark-mcp 的对比

| 功能 | icemark-mcp | icemark-agent-vscode |
|------|-------------|---------------------|
| **浏览器控制** | Electron BrowserWindow | Puppeteer + Chrome DevTools |
| **JavaScript执行** | `webContents.executeJavaScript()` | `page.evaluate()` |
| **页面导航** | `loadURL()` | `page.goto()` + `waitForNavigation()` |
| **网络监控** | 基础支持 | 丰富的网络状态监控 |
| **错误处理** | 基础重试机制 | 完善的错误恢复和重试 |
| **资源管理** | 手动管理 | 自动资源清理 |

## 🛠️ 开发指南

### 添加新的搜索引擎

1. **创建配置类**: 在 `config/` 目录下创建新的 `.ts` 配置文件
2. **实现 getConfig 方法**: 提供搜索引擎的具体配置
3. **编写 JavaScript 代码**: 实现输入、提取、翻页逻辑
4. **更新 SearchEngineService**: 在 `getConfigByName` 方法中添加新引擎
5. **测试验证**: 使用示例代码进行测试

示例新引擎配置：
```typescript
import { BaseSearchEngineConfig } from "./base_search_engine_config"

export class NewEngineConfig {
  static getConfig(): BaseSearchEngineConfig {
    return new BaseSearchEngineConfig({
      name: 'new_engine_search',
      homepageUrl: 'https://newengine.com/',
      // ... 其他配置
    });
  }
}
```

### 调试技巧

```typescript
// 启用详细日志
console.log('[Debug] 搜索配置:', searchService.getEngineInfo())

// 测试单个配置
const isValid = await searchService.testEngine('bing')
console.log('配置有效性:', isValid)
```

## ⚠️ 注意事项

### 反爬虫对策
- 实现了随机等待时间
- 支持自定义 User-Agent
- Cookie 自动管理

### 性能优化
- 浏览器实例复用
- 智能页面加载检测
- 资源自动清理

### 错误处理
- 网络超时自动重试
- 页面加载失败恢复
- JavaScript 执行异常处理

## 📈 未来扩展

### 计划中的功能
- [ ] 搜索结果缓存
- [ ] 并发搜索支持
- [ ] 搜索历史管理
- [ ] 更多搜索引擎支持
- [ ] 高级过滤选项

### 扩展接口
```typescript
// 自定义搜索器接口
interface CustomSearcher {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>
  getName(): string
  isAvailable(): Promise<boolean>
}
```

## 🔗 相关文档

- [BrowserSession API](../BrowserSession.ts) - 浏览器控制接口
- [配置示例](./config/) - 搜索引擎配置文件
- [使用示例](./example.ts) - 完整的使用示例
- [GeneralSearcher 实现](./GeneralSearcher.ts) - 核心搜索引擎实现 