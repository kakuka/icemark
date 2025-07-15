/**
 * 基础搜索引擎配置
 */
export class BaseSearchEngineConfig {
	// 占位符常量定义
	static PLACEHOLDERS = {
		QUERY: 'QUERY_PLACEHOLDER'
	}

	name: string
	homepageUrl: string
	cookieDomain?: string
	customHeaders?: Record<string, string>
	headerUrlPattern?: string
	waitTimeAfterSubmit?: number
	waitTimeAfterClick?: number
	inputAndSubmitJs: string
	validatePageJs?: string
	extractResultsJs: string
	clickNextPageJs: string

	constructor(config: any) {
		this.name = config.name
		this.homepageUrl = config.homepageUrl
		this.cookieDomain = config.cookieDomain
		this.customHeaders = config.customHeaders
		this.headerUrlPattern = config.headerUrlPattern
		this.waitTimeAfterSubmit = config.waitTimeAfterSubmit || 1500
		this.waitTimeAfterClick = config.waitTimeAfterClick || 2000
		this.inputAndSubmitJs = config.inputAndSubmitJs
		this.validatePageJs = config.validatePageJs
		this.extractResultsJs = config.extractResultsJs
		this.clickNextPageJs = config.clickNextPageJs
	}
} 