import * as vscode from "vscode"
import { GeneralSearcher, SearchResponse } from "./searcher/GeneralSearcher"
import { XiaoHongShuSearcher, XiaoHongShuSearchResponse } from "./searcher/XiaoHongShuSearcher"
import { ZhihuSearcher, ZhihuSearchResponse } from "./searcher/ZhihuSearcher"
import { WeiboSearcher, WeiboSearchResponse } from "./searcher/WeiboSearcher"
import { RedditSearcher, RedditSearchResponse } from "./searcher/RedditSearcher"
import { BingConfig } from "./searcher/config/bing_config"
import { BaiduConfig } from "./searcher/config/baidu_config"
import { DuckDuckGoConfig } from "./searcher/config/duckduckgo_config"
import { SogouConfig } from "./searcher/config/sogou_config"

// 搜索结果接口（为了向后兼容，保持原有的接口）
export interface SearchResult {
	title: string
	url: string
	snippet: string
	domain: string
}

// 搜索引擎服务
export class SearchEngineService {
	private context: vscode.ExtensionContext
	// 引擎优先级顺序：bing -> baidu -> sogou -> duckduckgo
	private enginePriority: string[] = ['bing', 'baidu', 'sogou', 'duckduckgo']

	constructor(context: vscode.ExtensionContext) {
		this.context = context
	}

	/**
	 * 获取所有可用的搜索引擎（按优先级排序）
	 */
	getAvailableEngines(): string[] {
		return [...this.enginePriority]
	}

	/**
	 * 根据引擎名称获取配置
	 */
	private getConfigByName(engineName: string) {
		switch (engineName.toLowerCase()) {
			case 'bing':
			case 'bing_search':
				return BingConfig.getConfig()
			case 'baidu':
			case 'baidu_search':
				return BaiduConfig.getConfig()
			case 'sogou':
			case 'sogou_search':
				return SogouConfig.getConfig()
			case 'duckduckgo':
			case 'duckduckgo_search':
				return DuckDuckGoConfig.getConfig()
			default:
				throw new Error(`不支持的搜索引擎: ${engineName}`)
		}
	}

	/**
	 * 执行网络搜索，按优先级逐个尝试搜索引擎
	 * @param keywords 关键词列表，长度应小于5
	 * @param pageLimit 搜索页数限制，默认3页，最大5页
	 * @param searchOn 搜索平台，'general'使用通用搜索引擎，'xiaohongshu'使用小红书搜索，'zhihu'使用知乎搜索，'weibo'使用微博搜索，'reddit'使用Reddit搜索，默认'general'
	 * @returns 搜索结果列表（最多30条）
	 */
	async search(keywords: string[], pageLimit: number = 3, searchOn: string = 'general'): Promise<SearchResult[]> {
		// 验证参数
		if (keywords.length === 0) {
			throw new Error("关键词列表不能为空")
		}
		if (keywords.length >= 5) {
			throw new Error("关键词数量不能超过4个")
		}

		// 过滤空关键词并构建查询字符串
		const validKeywords = keywords.filter(k => k.trim().length > 0)
		if (validKeywords.length === 0) {
			throw new Error("至少需要一个有效的关键词")
		}

		const query = validKeywords.join(" ")
		console.log(`[SearchEngineService] 开始搜索: "${query}", 页数: ${pageLimit}, 搜索平台: ${searchOn}`)

		// 根据搜索平台选择对应的搜索方法
		switch (searchOn.toLowerCase()) {
			case 'xiaohongshu':
				return this.searchXiaoHongShu(query, pageLimit)
			case 'zhihu':
				return this.searchZhihu(query, pageLimit)
			case 'weibo':
				return this.searchWeibo(query, pageLimit)
			case 'reddit':
				return this.searchReddit(query, pageLimit)
			case 'general':
			default:
				return this.searchGeneral(query, pageLimit)
		}
	}

	/**
	 * 使用通用搜索引擎执行搜索
	 * @param query 搜索查询
	 * @param pageLimit 搜索页数限制
	 * @returns 转换为通用格式的搜索结果
	 */
	private async searchGeneral(query: string, pageLimit: number): Promise<SearchResult[]> {
		let lastError: Error | null = null
		
		// 按优先级逐个尝试搜索引擎
		for (let i = 0; i < this.enginePriority.length; i++) {
			const engineName = this.enginePriority[i]
			console.log(`[SearchEngineService] 尝试使用搜索引擎: ${engineName} (${i + 1}/${this.enginePriority.length})`)
			
			try {
				// 加载搜索引擎配置
				const config = this.getConfigByName(engineName)
				
				// 创建搜索器实例
				const searcher = new GeneralSearcher(this.context, config)
				
				// 执行搜索
				const searchResponse: SearchResponse = await searcher.search(query, pageLimit)
				
				if (searchResponse.success && searchResponse.results.length > 0) {
					// 转换结果格式以保持向后兼容
					let results: SearchResult[] = searchResponse.results.map(result => ({
						title: result.title,
						url: result.url,
						snippet: result.description, // 将description映射为snippet
						domain: result.domain || this.extractDomain(result.url)
					}))

					console.log(`[SearchEngineService] 搜索成功，使用引擎: ${engineName}，获取到 ${results.length} 条结果`)
					return results
				} else {
					const error = new Error(`搜索引擎 ${engineName} 未返回有效结果: ${searchResponse.error || '未知错误'}`)
					console.warn(`[SearchEngineService] ${error.message}`)
					lastError = error
				}

			} catch (error) {
				const searchError = new Error(`搜索引擎 ${engineName} 执行失败: ${error instanceof Error ? error.message : String(error)}`)
				console.error(`[SearchEngineService] ${searchError.message}`)
				lastError = searchError
			}
		}

		// 所有搜索引擎都失败了
		const finalError = new Error(`所有搜索引擎都无法提供有效结果。最后一个错误: ${lastError?.message || '未知错误'}`)
		console.error(`[SearchEngineService] ${finalError.message}`)
		throw finalError
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
	 * 包装小红书搜索结果，将完整信息格式化为markdown
	 * @param note 小红书笔记对象
	 * @returns 格式化后的snippet
	 */
	private wrapXiaoHongShuResult(note: any): string {
		let snippet = ""
		
		// 基本信息
		snippet += `**作者**: ${note.authorName}\n`
		snippet += `**发布时间**: ${note.publishTime}\n`
		snippet += `**点赞数**: ${note.likeCount}\n`
		
		// 如果有详细内容，添加完整内容和互动数据
		if (note.detail) {
			if (note.detail.content) {
				snippet += `\n**完整内容**:\n${note.detail.content}\n`
			}
			
			snippet += `\n**互动数据**:\n`
			snippet += `- 点赞: ${note.detail.likeCount}\n`
			snippet += `- 收藏: ${note.detail.collectCount}\n`
			snippet += `- 评论: ${note.detail.commentCount}\n`
			
			// 如果有评论，添加所有评论
			if (note.detail.comments && note.detail.comments.length > 0) {
				snippet += `\n**所有评论**:\n`
				note.detail.comments.forEach((comment: any, index: number) => {
					snippet += `${index + 1}. **${comment.author}**: ${comment.content}`
					if (comment.likeCount && comment.likeCount !== '0') {
						snippet += ` (👍 ${comment.likeCount})`
					}
					if (comment.time) {
						snippet += ` _${comment.time}_`
					}
					snippet += `\n`
				})
			}
		} else {
			// 如果没有详细内容，显示基本信息
			snippet += `\n暂无详细内容，点击链接查看完整笔记。`
		}
		
		return snippet
	}

	/**
	 * 包装知乎搜索结果，将完整信息格式化为markdown
	 * @param answer 知乎回答对象
	 * @returns 格式化后的snippet
	 */
	private wrapZhihuResult(answer: any): string {
		let snippet = ""
		
		// 问题信息
		snippet += `**问题**: ${answer.questionTitle}\n`
		snippet += `**回答者**: ${answer.author}\n`
		snippet += `**发布时间**: ${answer.publishTime}\n`
		snippet += `**点赞数**: ${answer.likeCount}\n`
		snippet += `**评论数**: ${answer.commentCount}\n`
		
		// 完整回答内容
		if (answer.content) {
			snippet += `\n**完整回答**:\n${answer.content}\n`
		}
		
		// 如果有评论，添加所有评论
		if (answer.comments && answer.comments.length > 0) {
			snippet += `\n**所有评论**:\n`
			answer.comments.forEach((comment: any, index: number) => {
				snippet += `${index + 1}. **${comment.author}**: ${comment.content}`
				if (comment.likeCount && comment.likeCount !== '0') {
					snippet += ` (👍 ${comment.likeCount})`
				}
				if (comment.time) {
					snippet += ` _${comment.time}_`
				}
				snippet += `\n`
			})
		}
		
		return snippet
	}

	/**
	 * 包装微博搜索结果，将完整信息格式化为markdown
	 * @param post 微博对象
	 * @returns 格式化后的snippet
	 */
	private wrapWeiboResult(post: any): string {
		let snippet = ""
		
		// 基本信息
		snippet += `**博主**: ${post.author}\n`
		snippet += `**发布时间**: ${post.publishTime}\n`
		
		// 互动数据
		snippet += `**互动数据**: 转发 ${post.repostCount} | 评论 ${post.commentCount} | 点赞 ${post.likeCount}\n`
		
		// 微博内容
		if (post.content) {
			snippet += `\n**微博内容**:\n${post.content}\n`
		}
		
		// 如果有评论，添加所有评论
		if (post.comments && post.comments.length > 0) {
			snippet += `\n**所有评论**:\n`
			post.comments.forEach((comment: any, index: number) => {
				snippet += `${index + 1}. **${comment.author}**: ${comment.content}`
				if (comment.likeCount && comment.likeCount !== '0') {
					snippet += ` (👍 ${comment.likeCount})`
				}
				if (comment.time) {
					snippet += ` _${comment.time}_`
				}
				snippet += `\n`
			})
		}
		
		return snippet
	}

	/**
	 * 测试搜索引擎配置
	 * @param engineName 搜索引擎名称
	 * @returns 配置是否有效
	 */
	async testEngine(engineName: string): Promise<boolean> {
		try {
			const config = this.getConfigByName(engineName)
			console.log(`[SearchEngineService] 测试搜索引擎配置: ${config.name}`)
			return true
		} catch (error) {
			console.error(`[SearchEngineService] 搜索引擎配置测试失败:`, error)
			return false
		}
	}

	/**
	 * 获取搜索引擎配置信息
	 */
	getEngineInfo(engineName: string): any {
		try {
			const config = this.getConfigByName(engineName)
			
			return {
				name: config.name,
				homepageUrl: config.homepageUrl,
				cookieDomain: config.cookieDomain,
				waitTimeAfterSubmit: config.waitTimeAfterSubmit,
				waitTimeAfterClick: config.waitTimeAfterClick,
				hasCustomHeaders: !!config.customHeaders,
				hasValidatePageJs: !!config.validatePageJs
			}
		} catch (error) {
			console.error(`[SearchEngineService] 获取搜索引擎信息失败:`, error)
			return null
		}
	}

	/**
	 * 获取所有搜索引擎的配置信息
	 */
	getAllEngineInfo(): any[] {
		return this.enginePriority.map(engineName => ({
			engineName,
			...this.getEngineInfo(engineName)
		})).filter(info => info !== null)
	}

	/**
	 * 使用小红书搜索器执行搜索
	 * @param query 搜索查询
	 * @param pageLimit 搜索页数限制
	 * @returns 转换为通用格式的搜索结果
	 */
	private async searchXiaoHongShu(query: string, pageLimit: number): Promise<SearchResult[]> {
		try {
			console.log(`[SearchEngineService] 使用小红书搜索器搜索: "${query}"`)
			
			// 计算最大结果数：每页大约10条结果
			const maxResults = pageLimit * 10
			
			const searcher = new XiaoHongShuSearcher(this.context)
			const searchResponse: XiaoHongShuSearchResponse = await searcher.search(query, maxResults, false)
			
			if (searchResponse.success && searchResponse.results.length > 0) {
				// 将小红书搜索结果转换为通用格式，使用包装函数生成丰富的snippet
				const results: SearchResult[] = searchResponse.results.map(note => ({
					title: note.title,
					url: note.noteLink,
					snippet: this.wrapXiaoHongShuResult(note),
					domain: 'xiaohongshu.com'
				}))

				console.log(`[SearchEngineService] 小红书搜索成功，获取到 ${results.length} 条结果`)
				return results
			} else {
				throw new Error(`小红书搜索失败: ${searchResponse.error || '未返回有效结果'}`)
			}
		} catch (error) {
			const errorMessage = `小红书搜索执行失败: ${error instanceof Error ? error.message : String(error)}`
			console.error(`[SearchEngineService] ${errorMessage}`)
			throw new Error(errorMessage)
		}
	}

	/**
	 * 使用知乎搜索器执行搜索
	 * @param query 搜索查询
	 * @param pageLimit 搜索页数限制
	 * @returns 转换为通用格式的搜索结果
	 */
	private async searchZhihu(query: string, pageLimit: number): Promise<SearchResult[]> {
		try {
			console.log(`[SearchEngineService] 使用知乎搜索器搜索: "${query}"`)
			
			// 计算最大结果数：每页大约10条结果
			const maxResults = pageLimit * 10
			
			const searcher = new ZhihuSearcher(this.context)
			const searchResponse: ZhihuSearchResponse = await searcher.search(query, maxResults, false)
			
			if (searchResponse.success && searchResponse.results.length > 0) {
				// 将知乎搜索结果转换为通用格式，使用包装函数生成丰富的snippet
				const results: SearchResult[] = searchResponse.results.map(answer => ({
					title: answer.questionTitle,
					url: answer.answerUrl || answer.questionUrl,
					snippet: this.wrapZhihuResult(answer),
					domain: 'zhihu.com'
				}))

				console.log(`[SearchEngineService] 知乎搜索成功，获取到 ${results.length} 条结果`)
				return results
			} else {
				throw new Error(`知乎搜索失败: ${searchResponse.error || '未返回有效结果'}`)
			}
		} catch (error) {
			const errorMessage = `知乎搜索执行失败: ${error instanceof Error ? error.message : String(error)}`
			console.error(`[SearchEngineService] ${errorMessage}`)
			throw new Error(errorMessage)
		}
	}

	/**
	 * 使用微博搜索器执行搜索
	 * @param query 搜索查询
	 * @param pageLimit 搜索页数限制
	 * @returns 转换为通用格式的搜索结果
	 */
	private async searchWeibo(query: string, pageLimit: number): Promise<SearchResult[]> {
		try {
			console.log(`[SearchEngineService] 使用微博搜索器搜索: "${query}"`)
			
			// 计算最大结果数：每页大约20条结果
			const maxResults = pageLimit * 20
			
			const searcher = new WeiboSearcher(this.context)
			const searchResponse: WeiboSearchResponse = await searcher.search(query, maxResults, false)
			
			if (searchResponse.success && searchResponse.results.length > 0) {
				// 将微博搜索结果转换为通用格式，使用包装函数生成丰富的snippet
				const results: SearchResult[] = searchResponse.results.map(post => ({
					title: `${post.author}: ${post.content.substring(0, 50)}...`,
					url: post.weiboLink,
					snippet: this.wrapWeiboResult(post),
					domain: 'weibo.com'
				}))

				console.log(`[SearchEngineService] 微博搜索成功，获取到 ${results.length} 条结果`)
				return results
			} else {
				throw new Error(`微博搜索失败: ${searchResponse.error || '未返回有效结果'}`)
			}
		} catch (error) {
			const errorMessage = `微博搜索执行失败: ${error instanceof Error ? error.message : String(error)}`
			console.error(`[SearchEngineService] ${errorMessage}`)
			throw new Error(errorMessage)
		}
	}

	/**
	 * 使用 Reddit 搜索器执行搜索
	 * @param query 搜索查询
	 * @param pageLimit 搜索页数限制
	 * @returns 转换为通用格式的搜索结果
	 */
	private async searchReddit(query: string, pageLimit: number): Promise<SearchResult[]> {
		try {
			console.log(`[SearchEngineService] 使用 Reddit 搜索器搜索: "${query}"`)
			
			// 计算最大结果数：每页大约10条结果
			const maxResults = pageLimit * 10
			
			const searcher = new RedditSearcher(this.context)
			const searchResponse: RedditSearchResponse = await searcher.search(query, maxResults, false)
			
			if (searchResponse.success && searchResponse.results.length > 0) {
				// 将 Reddit 搜索结果转换为通用格式，使用包装函数生成丰富的snippet
				const results: SearchResult[] = searchResponse.results.map(post => ({
					title: post.title,
					url: post.postLink,
					snippet: this.wrapRedditResult(post),
					domain: 'reddit.com'
				}))

				console.log(`[SearchEngineService] Reddit 搜索成功，获取到 ${results.length} 条结果`)
				return results
			} else {
				throw new Error(`Reddit 搜索失败: ${searchResponse.error || '未返回有效结果'}`)
			}
		} catch (error) {
			const originalMessage = error instanceof Error ? error.message : String(error)
			// 如果错误信息已经包含了"搜索没有找到相关结果"，就不要再包装了
			if (originalMessage.includes('搜索没有找到相关结果')) {
				console.error(`[SearchEngineService] ${originalMessage}`)
				throw new Error(originalMessage)
			} else {
				const errorMessage = `Reddit 搜索执行失败: ${originalMessage}`
				console.error(`[SearchEngineService] ${errorMessage}`)
				throw new Error(errorMessage)
			}
		}
	}

	/**
	 * 包装 Reddit 搜索结果，将完整信息格式化为markdown
	 * @param post Reddit 帖子对象
	 * @returns 格式化后的snippet
	 */
	private wrapRedditResult(post: any): string {
		let snippet = ""
		
		// 显示 subreddit 和作者信息
		snippet += `**Subreddit**: r/${post.subreddit}\n`
		snippet += `**作者**: u/${post.author}\n`
		snippet += `**发布时间**: ${post.publishTime}\n`
		
		// 互动数据
		snippet += `**互动数据**: ⬆️ ${post.upvotes} | 💬 ${post.commentCount}\n`
		
		// 帖子内容
		if (post.content && post.content.trim().length > 0) {
			snippet += `\n**帖子内容**:\n${post.content}\n`
		}
		
		// 如果有评论，添加评论信息
		if (post.comments && post.comments.length > 0) {
			snippet += `\n**热门评论**:\n`
			post.comments.forEach((comment: any, index: number) => {
				snippet += `${index + 1}. **u/${comment.author}**: ${comment.content}`
				if (comment.upvotes && comment.upvotes !== '0') {
					snippet += ` (⬆️ ${comment.upvotes})`
				}
				if (comment.time) {
					snippet += ` _${comment.time}_`
				}
				snippet += `\n`
			})
		}
		
		return snippet
	}
} 