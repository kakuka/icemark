import * as vscode from "vscode"
import { BrowserSession } from "../BrowserSession"
import { BaseSearchEngineConfig } from "./config/base_search_engine_config"

// 搜索结果接口
export interface SearchResult {
	title: string
	url: string
	description: string
	domain?: string
}

// 搜索结果类型
export interface SearchResponse {
	success: boolean
	error?: string
	results: SearchResult[]
	meta: {
		total_pages_queried: number
		total_unique_results: number
	}
}

// 占位符常量
const QUERY_PLACEHOLDER = 'QUERY_PLACEHOLDER'

/**
 * 通用搜索引擎
 * 基于配置驱动的搜索引擎框架，使用Puppeteer控制浏览器
 */
export class GeneralSearcher {
	private context: vscode.ExtensionContext
	private browserSession: BrowserSession
	private config: BaseSearchEngineConfig

	constructor(context: vscode.ExtensionContext, config: BaseSearchEngineConfig) {
		this.context = context
		this.browserSession = new BrowserSession(context)
		this.config = config
	}

	/**
	 * 清除Cookie（Puppeteer版本）
	 */
	private async clearCookies(domain: string): Promise<void> {
		console.log(`[GeneralSearcher] 尝试清除 ${domain} 的cookies...`)
		
		try {
			if (!this.browserSession['page']) {
				console.log(`[GeneralSearcher] 页面未初始化，跳过cookie清除`)
				return
			}

			const page = this.browserSession['page']
			const cookies = await page.cookies()
			const domainCookies = cookies.filter(cookie => 
				cookie.domain === domain || cookie.domain === `.${domain}`
			)

			if (domainCookies.length > 0) {
				console.log(`[GeneralSearcher] 找到 ${domainCookies.length} 个 ${domain} 域的cookies，正在删除...`)
				for (const cookie of domainCookies) {
					await page.deleteCookie(cookie)
				}
				console.log(`[GeneralSearcher] 成功清除 ${domain} 域的cookies`)
			} else {
				console.log(`[GeneralSearcher] 未找到 ${domain} 域的cookies`)
			}
		} catch (error) {
			console.error(`[GeneralSearcher] 清除 ${domain} 域cookies时出错:`, error)
		}
	}

	/**
	 * 执行输入和提交操作
	 */
	private async executeInputAndSubmit(query: string, maxAttempts: number = 50, attemptInterval: number = 100): Promise<void> {
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			try {
				// 替换JavaScript代码中的占位符
				const jsCode = this.config.inputAndSubmitJs.replace(
					QUERY_PLACEHOLDER,
					query.replace(/'/g, "\\'")
				)

				const page = this.browserSession['page']
				if (!page) {
					throw new Error("页面未初始化")
				}

				const success = await page.evaluate(jsCode)
				if (success) {
					console.log('[GeneralSearcher] 输入和提交成功')
					return
				}
			} catch (e) {
				console.warn(`[GeneralSearcher] 第 ${attempt + 1} 次尝试输入/提交JS失败:`, e instanceof Error ? e.message : e)
			}
			
			if (attempt < maxAttempts - 1) {
				await this.delay(attemptInterval)
			}
		}
		
		throw new Error(`经过 ${maxAttempts} 次尝试后仍无法输入和提交`)
	}

	/**
	 * 执行结果提取操作
	 */
	private async executeExtractResults(query: string, maxAttempts: number = 30, attemptInterval: number = 1000): Promise<SearchResult[]> {
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			try {
				const page = this.browserSession['page']
				if (!page) {
					throw new Error("页面未初始化")
				}

				// 检查是否在正确的页面上（如果配置了验证函数）
				if (this.config.validatePageJs) {
					const isValidPage = await page.evaluate(this.config.validatePageJs)
					if (!isValidPage) {
						console.warn(`[GeneralSearcher] 第 ${attempt + 1} 次尝试：不在正确的搜索结果页面，重试...`)
						if (attempt < maxAttempts - 1) {
							await this.delay(attemptInterval * 2)
						}
						continue
					}
				}

				const results = await page.evaluate(this.config.extractResultsJs) as SearchResult[]
				if (results && results.length > 0) {
					console.log(`[GeneralSearcher] 第 ${attempt + 1} 次尝试提取到 ${results.length} 个结果`)
					
					// 为结果添加域名信息
					return results.map(result => ({
						...result,
						domain: this.extractDomain(result.url)
					}))
				}
				
				console.log(`[GeneralSearcher] 第 ${attempt + 1} 次尝试：未提取到结果或结果数组为空`)
			} catch (e) {
				console.warn(`[GeneralSearcher] 第 ${attempt + 1} 次尝试提取结果JS失败:`, e instanceof Error ? e.message : e)
			}
			
			if (attempt < maxAttempts - 1) {
				await this.delay(attemptInterval)
			}
		}
		
		console.warn(`[GeneralSearcher] 经过 ${maxAttempts} 次尝试后仍未提取到 "${query}" 的结果`)
		return []
	}

	/**
	 * 执行点击下一页操作
	 */
	private async executeClickNextPage(currentPageNum: number, maxAttempts: number = 30, attemptInterval: number = 1000): Promise<boolean> {
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			try {
				const page = this.browserSession['page']
				if (!page) {
					throw new Error("页面未初始化")
				}

				const clicked = await page.evaluate(this.config.clickNextPageJs)
				if (clicked) {
					console.log(`[GeneralSearcher] 第 ${attempt + 1} 次尝试成功点击下一页 (从第 ${currentPageNum} 页)`)
					return true
				}
			} catch (e) {
				console.warn(`[GeneralSearcher] 第 ${attempt + 1} 次尝试点击下一页JS失败:`, e instanceof Error ? e.message : e)
			}
			
			if (attempt < maxAttempts - 1) {
				await this.delay(attemptInterval)
			}
		}
		
		console.log(`[GeneralSearcher] 经过 ${maxAttempts} 次尝试后仍无法找到或点击下一页按钮 (从第 ${currentPageNum} 页)`)
		return false
	}

	/**
	 * 设置自定义请求头
	 */
	private async setupCustomHeaders(): Promise<void> {
		if (!this.config.customHeaders) {
			return
		}

		console.log('[GeneralSearcher] 设置自定义请求头:', this.config.customHeaders)
		if (this.config.headerUrlPattern) {
			console.log('[GeneralSearcher] URL过滤模式:', this.config.headerUrlPattern)
		}

		const page = this.browserSession['page']
		if (!page) {
			throw new Error("页面未初始化")
		}

		await page.setExtraHTTPHeaders(this.config.customHeaders)
	}

	/**
	 * 执行搜索
	 */
	async search(query: string, pageLimit: number = 1): Promise<SearchResponse> {
		if (!query || String(query).trim() === '') {
			console.error('[GeneralSearcher] 搜索查询不能为空')
			return { 
				success: false, 
				error: '搜索查询不能为空',
				results: [],
				meta: { total_pages_queried: 0, total_unique_results: 0 }
			}
		}

		const finalPageLimit = Math.min(5, Math.max(1, parseInt(String(pageLimit)) || 1))
		console.log(`[GeneralSearcher] 执行搜索: "${query}", 使用引擎: ${this.config.name}, 总页数: ${finalPageLimit}`)

		const allPageResults: SearchResult[] = []
		let operationError: string | undefined

		try {
			// 启动浏览器
			await this.browserSession.launchBrowser(false)

			// 设置自定义请求头
			await this.setupCustomHeaders()

			// 清除cookies（如果配置了域名）
			if (this.config.cookieDomain) {
				await this.clearCookies(this.config.cookieDomain)
			}

			console.log(`[GeneralSearcher] 加载首页: ${this.config.homepageUrl}`)
			await this.browserSession.navigateToUrl(this.config.homepageUrl)
			console.log('[GeneralSearcher] 首页加载完成')

			console.log(`[GeneralSearcher] 尝试输入查询: "${query}"`)
			await this.executeInputAndSubmit(query)

			// 等待搜索结果页面加载
			const waitTime = this.config.waitTimeAfterSubmit || 1500
			await this.delay(waitTime)
			console.log('[GeneralSearcher] 搜索结果页面加载完成')

			// 循环获取多页结果
			for (let currentPage = 1; currentPage <= finalPageLimit; currentPage++) {
				console.log(`[GeneralSearcher] 处理第 ${currentPage} 页...`)

				if (currentPage > 1) {
					console.log(`[GeneralSearcher] 尝试点击下一页 (到第 ${currentPage} 页)...`)
					const nextPageClicked = await this.executeClickNextPage(currentPage - 1)
					if (!nextPageClicked) {
						console.log(`[GeneralSearcher] 无法导航到第 ${currentPage} 页，结束搜索`)
						break
					}

					// 等待翻页后的导航
					const waitTimeAfterClick = this.config.waitTimeAfterClick || 2000
					await this.delay(waitTimeAfterClick)
					console.log(`[GeneralSearcher] 第 ${currentPage} 页导航完成`)
				}

				console.log(`[GeneralSearcher] 尝试提取第 ${currentPage} 页的结果...`)
				const singlePageResults = await this.executeExtractResults(query)

				if (singlePageResults.length > 0) {
					allPageResults.push(...singlePageResults)
				} else {
					console.log(`[GeneralSearcher] 第 ${currentPage} 页无结果，或提取失败`)
				}
			}

		} catch (err) {
			console.error(`[GeneralSearcher] 搜索过程中发生严重错误:`, err)
			operationError = err instanceof Error ? err.message : String(err)
		} finally {
			// 确保关闭浏览器
			await this.browserSession.closeBrowser()
		}

		// 去重
		const uniqueResults = this.deduplicateResults(allPageResults)

		console.log(`[GeneralSearcher] 搜索完成，总共获取到 ${uniqueResults.length} 条独立结果 (目标查询 ${finalPageLimit} 页)`)
		
		return {
			success: !operationError,
			error: operationError,
			results: uniqueResults,
			meta: { 
				total_pages_queried: finalPageLimit, 
				total_unique_results: uniqueResults.length 
			}
		}
	}

	/**
	 * 结果去重
	 */
	private deduplicateResults(results: SearchResult[]): SearchResult[] {
		const uniqueUrls = new Set<string>()
		return results.filter(result => {
			if (result.url && !uniqueUrls.has(result.url)) {
				uniqueUrls.add(result.url)
				return true
			}
			return false
		})
	}

	/**
	 * 从URL提取域名
	 */
	private extractDomain(url: string): string {
		try {
			return new URL(url).hostname
		} catch (error) {
			return 'unknown'
		}
	}

	/**
	 * 延迟工具函数
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
} 