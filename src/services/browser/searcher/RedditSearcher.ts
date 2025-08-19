import * as vscode from "vscode"
import { BrowserSession } from "../BrowserSession"

// Reddit 搜索结果接口
export interface RedditPost {
	title: string
	postLink: string
	author: string
	authorLink?: string
	subreddit: string
	subredditLink: string
	publishTime: string
	upvotes: string
	commentCount: string
	content: string
	comments: RedditComment[]
}

export interface RedditComment {
	author: string
	authorLink?: string
	content: string
	time: string
	upvotes: string
}

export interface RedditSearchResponse {
	success: boolean
	error?: string
	results: RedditPost[]
	meta: {
		total_results: number
		query: string
		subreddits: string[]
		keywords: string[]
	}
}

/**
 * Reddit 搜索器
 * 支持智能关键词解析，自动识别 r/subreddit 语法
 */
export class RedditSearcher {
	private context: vscode.ExtensionContext
	private browserSession: BrowserSession

	constructor(context: vscode.ExtensionContext) {
		this.context = context
		this.browserSession = new BrowserSession(context)
	}

	/**
	 * 智能解析搜索查询，自动识别 Reddit 特有语法
	 */
	private parseQuery(query: string): { subreddits: string[], keywords: string[], searchUrl: string } {
		const words = query.split(/\s+/).filter(word => word.trim().length > 0)
		const subreddits: string[] = []
		const keywords: string[] = []
		
		for (const word of words) {
			// 识别 r/subreddit 格式
			const subredditMatch = word.match(/^r\/([a-zA-Z0-9_]+)$/)
			if (subredditMatch) {
				subreddits.push(subredditMatch[1])
				continue
			}
			
			// 识别 subreddit: 前缀格式
			if (word.startsWith('subreddit:')) {
				const subredditName = word.substring(10)
				if (subredditName.length > 0 && /^[a-zA-Z0-9_]+$/.test(subredditName)) {
					subreddits.push(subredditName)
					continue
				}
			}
			
			keywords.push(word)
		}
		
		const searchUrl = this.buildSearchUrl(subreddits, keywords)
		return { subreddits, keywords, searchUrl }
	}

	/**
	 * 根据解析结果构建 Reddit 搜索 URL
	 */
	private buildSearchUrl(subreddits: string[], keywords: string[]): string {
		if (subreddits.length === 1 && keywords.length > 0) {
			// 单个 subreddit + 关键词：使用 subreddit 内搜索
			const subreddit = subreddits[0]
			return `https://www.reddit.com/r/${subreddit}/search/?q=${encodeURIComponent(keywords.join(' '))}&restrict_sr=1&sort=relevance`
		} else if (subreddits.length > 1) {
			// 多个 subreddit：使用高级搜索语法
			const subredditQuery = subreddits.map(sub => `subreddit:${sub}`).join(' OR ')
			if (keywords.length > 0) {
				const combinedQuery = `(${subredditQuery}) AND (${keywords.join(' ')})`
				return `https://www.reddit.com/search/?q=${encodeURIComponent(combinedQuery)}&type=link&sort=relevance`
			} else {
				return `https://www.reddit.com/search/?q=${encodeURIComponent(subredditQuery)}&type=link&sort=relevance`
			}
		} else if (subreddits.length === 1 && keywords.length === 0) {
			// 只有 subreddit，没有关键词：浏览该 subreddit 的热门内容
			const subreddit = subreddits[0]
			return `https://www.reddit.com/r/${subreddit}/hot/`
		} else {
			// 全站搜索：只有普通关键词
			return `https://www.reddit.com/search/?q=${encodeURIComponent(keywords.join(' '))}&type=link&sort=relevance`
		}
	}

	/**
	 * 执行 Reddit 搜索
	 */
	async search(query: string, maxResults: number = 10, needAuthorUrl: boolean = false): Promise<RedditSearchResponse> {
		if (!query || String(query).trim() === '') {
			return { 
				success: false, 
				error: '搜索查询不能为空',
				results: [],
				meta: { total_results: 0, query: query, subreddits: [], keywords: [] }
			}
		}

		// 智能解析查询
		const parsed = this.parseQuery(query)
		
		console.log(`[RedditSearcher] 执行 Reddit 搜索: "${query}", 最大结果数: ${maxResults}`)
		console.log(`[RedditSearcher] 解析结果 - Subreddits: [${parsed.subreddits.join(', ')}], Keywords: [${parsed.keywords.join(', ')}]`)

		try {
			await this.browserSession.launchBrowser(false)
			await this.browserSession.navigateToUrl(parsed.searchUrl)
			await this.delay(1000 + Math.random() * 1000)

			// 等待页面内容加载
			await this.waitForContent()

			// 提取搜索结果（支持滚动加载）
			const results = await this.extractResultsWithScrolling(maxResults, needAuthorUrl)

			return {
				success: true,
				results: results,
				meta: { 
					total_results: results.length, 
					query: query,
					subreddits: parsed.subreddits,
					keywords: parsed.keywords
				}
			}

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[RedditSearcher] 搜索失败:`, errorMessage)
			
			return {
				success: false,
				error: errorMessage,
				results: [],
				meta: { 
					total_results: 0, 
					query: query,
					subreddits: parsed.subreddits,
					keywords: parsed.keywords
				}
			}
		} finally {
			await this.browserSession.closeBrowser()
		}
	}

	/**
	 * 等待页面内容加载
	 */
	private async waitForContent(): Promise<void> {
		let hasContent = false
		let checkCount = 0
		const maxChecks = 60
		
		while (!hasContent && checkCount < maxChecks) {
			checkCount++
			
			const page = (this.browserSession as any)['page']
			if (!page) throw new Error("页面未初始化")

			const pageStatus = await page.evaluate(() => {
				// 检查是否有帖子
				const searchSduiPosts = document.querySelectorAll('[data-testid="search-sdui-post"]')
				const searchPostUnits = document.querySelectorAll('[data-testid="search-post-unit"]')
				const postTitleTexts = document.querySelectorAll('[data-testid="post-title-text"]')
				
				// 检查是否有"无结果"页面
				const searchErrorMessage = document.querySelector('[data-testid="search-error-message"]')
				
				if (searchErrorMessage) {
					return { status: 'no_results', message: searchErrorMessage.textContent || '' }
				}
				
				if (searchSduiPosts.length > 0 || searchPostUnits.length > 0 || postTitleTexts.length > 0) {
					return { status: 'has_content' }
				}
				
				return { status: 'loading' }
			})
			
			if (pageStatus.status === 'no_results') {
				throw new Error(`搜索没有找到相关结果: ${pageStatus.message}`)
			}
			
			if (pageStatus.status === 'has_content') {
				hasContent = true
			} else {
				await this.delay(5000)
			}
		}

		if (!hasContent) {
			throw new Error(`页面内容加载超时，可能需要登录或页面加载失败`)
		}
	}

	/**
	 * 提取搜索结果（支持滚动加载）
	 */
	private async extractResultsWithScrolling(maxResults: number, needAuthorUrl: boolean): Promise<RedditPost[]> {
		const page = (this.browserSession as any)['page']
		if (!page) throw new Error("页面未初始化")

		return await page.evaluate(async (maxResults: number, needAuthorUrl: boolean) => {
			// 滚动到顶部开始
			window.scrollTo(0, 0)
			await new Promise(resolve => setTimeout(resolve, 1000))
			
			const allResults: any[] = []
			let noNewResultsCount = 0
			let lastPostCount = 0
			
			while (allResults.length < maxResults && noNewResultsCount < 3) {
				// 1. 查找当前页面的帖子
				const postElements = document.querySelectorAll(
					'[data-testid="search-sdui-post"], [data-testid="search-post-unit"], [data-testid="post-container"]'
				)
				
				console.log(`找到 ${postElements.length} 个帖子元素`)
				
				// 2. 提取帖子信息
				const currentPosts = []
				for (let i = 0; i < postElements.length; i++) {
					const postElement = postElements[i]
					try {
						// 提取标题和链接
						const titleElement = postElement.querySelector('[data-testid="post-title-text"]') as HTMLAnchorElement
						const title = titleElement?.textContent?.trim() || ''
						if (!title) continue
						
						let postLink = titleElement?.href || ''
						if (postLink && !postLink.startsWith('http')) {
							postLink = 'https://www.reddit.com' + postLink
						}
						
						// 提取 subreddit
						let subreddit = ''
						if (postLink) {
							const match = postLink.match(/\/r\/([^\/]+)\//)
							if (match) subreddit = match[1]
						}
						
						// 提取发布时间
						const timeElement = postElement.querySelector('faceplate-timeago time')
						const publishTime = timeElement?.getAttribute('title') || timeElement?.textContent || ''
						
						// 提取投票数和评论数
						const counterRow = postElement.querySelector('[data-testid="search-counter-row"]')
						const voteElements = counterRow?.querySelectorAll('faceplate-number')
						const upvotes = voteElements?.[0]?.textContent?.trim() || '0'
						const commentCount = voteElements?.[1]?.textContent?.trim() || '0'
						
						// 提取作者
						const authorElement = postElement.querySelector('a[href*="/user/"], a[href*="/u/"]') as HTMLAnchorElement
						const author = authorElement?.textContent?.replace(/^u\//, '').trim() || 'Unknown'
						
						currentPosts.push({
							title,
							postLink: postLink || `https://www.reddit.com/r/${subreddit}/`,
							author,
							authorLink: needAuthorUrl ? authorElement?.href : undefined,
							subreddit,
							subredditLink: `https://www.reddit.com/r/${subreddit}/`,
							publishTime,
							upvotes,
							commentCount,
							content: `Reddit post: ${title}`,
							comments: []
						})
						
					} catch (error) {
						console.error(`提取第${i+1}个帖子时出错:`, error)
					}
				}
				
				// 3. 去重并添加新帖子
				const newPosts = currentPosts.filter(newPost => 
					!allResults.some(existing => existing.postLink === newPost.postLink)
				)
				allResults.push(...newPosts)
				
				console.log(`当前结果数: ${allResults.length}/${maxResults}，新增: ${newPosts.length}`)
				
				// 4. 检查是否需要继续滚动
				if (postElements.length === lastPostCount) {
					noNewResultsCount++
				} else {
					noNewResultsCount = 0
				}
				lastPostCount = postElements.length
				
				if (allResults.length >= maxResults) break
				
				// 5. 滚动加载更多内容
				window.scrollTo(0, document.body.scrollHeight)
				await new Promise(resolve => setTimeout(resolve, 500))
				window.scrollTo(0, 0)
				await new Promise(resolve => setTimeout(resolve, 500))
				window.scrollTo(0, document.body.scrollHeight)
				await new Promise(resolve => setTimeout(resolve, 500))
			}
			
			return allResults.slice(0, maxResults)
		}, maxResults, needAuthorUrl)
	}



	/**
	 * 延迟函数
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
} 