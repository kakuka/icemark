import * as vscode from "vscode"
import { BrowserSession } from "../BrowserSession"

/**
 * Reddit 帖子内容接口
 */
export interface RedditPostContent {
	title: string
	author: string
	subreddit: string
	publishTime: string
	upvotes: string
	commentCount: string
	content: string
	comments: RedditComment[]
	url: string
}

/**
 * Reddit 评论接口
 */
export interface RedditComment {
	author: string
	content: string
	upvotes: string
	publishTime: string
	replies?: RedditComment[]
}

/**
 * Reddit 内容获取器
 * 专门用于提取和格式化 Reddit 帖子内容
 */
export class RedditContentFetcher {
	private context: vscode.ExtensionContext
	private browserSession: BrowserSession

	constructor(context: vscode.ExtensionContext, browserSession: BrowserSession) {
		this.context = context
		this.browserSession = browserSession
	}

	/**
	 * 检查 URL 是否为 Reddit 链接
	 */
	static isRedditUrl(url: string): boolean {
		try {
			const urlObj = new URL(url)
			return urlObj.hostname.includes('reddit.com')
		} catch {
			return false
		}
	}



	/**
	 * 从 Reddit URL 提取内容并转换为 Markdown
	 */
	async fetchRedditContent(url: string): Promise<string> {
		if (!RedditContentFetcher.isRedditUrl(url)) {
			throw new Error("提供的 URL 不是 Reddit 链接")
		}

		console.log(`[RedditContentFetcher] 开始提取 Reddit 内容: ${url}`)

		try {
			// 页面已经由 UrlContentFetcher 导航，直接提取内容
			const postContent = await this.extractPostContent()

			// 转换为 Markdown 格式
			const markdown = this.formatToMarkdown(postContent)

			console.log(`[RedditContentFetcher] 成功提取内容，长度: ${markdown.length} 字符`)
			return markdown

		} catch (error) {
			console.error(`[RedditContentFetcher] 提取失败:`, error)
			throw new Error(`Reddit 内容提取失败: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * 提取 Reddit 帖子内容
	 */
	private async extractPostContent(): Promise<RedditPostContent> {
		const page = (this.browserSession as any)['page']
		if (!page) {
			throw new Error("页面未初始化")
		}

		// 等待页面内容加载 - 检查是否有 main-content
		try {
			await page.waitForSelector('#main-content', { timeout: 5000 })
		} catch {
			throw new Error("页面内容未加载或不是有效的 Reddit 帖子页面")
		}
		await new Promise(resolve => setTimeout(resolve, 2000))

		return await page.evaluate(() => {
			// 检查是否有内容
			const mainContent = document.querySelector('#main-content')
			if (!mainContent) {
				throw new Error("未找到主要内容区域")
			}

			// 提取标题 - 从 shreddit-title 元素
			const titleElement = document.querySelector('shreddit-title')
			const title = titleElement?.getAttribute('title') || '无标题'

			// 提取 shreddit-post 元素获取基本信息
			const postElement = document.querySelector('shreddit-post')
			if (!postElement) {
				throw new Error("未找到帖子元素")
			}

			// 从 shreddit-post 属性中提取信息
			const author = postElement.getAttribute('author') || '未知用户'
			const subredditName = postElement.getAttribute('subreddit-name') || '未知板块'
			const commentCount = postElement.getAttribute('comment-count') || '0'
			const score = postElement.getAttribute('score') || '0'
			const createdTimestamp = postElement.getAttribute('created-timestamp') || ''

			// 格式化时间
			let publishTime = '未知时间'
			if (createdTimestamp) {
				try {
					const date = new Date(createdTimestamp)
					publishTime = date.toLocaleString('zh-CN')
				} catch {
					publishTime = createdTimestamp
				}
			}

			// 提取帖子内容 - 从 slot="text-body" 中的内容
			let content = ''
			const textBodyElement = postElement.querySelector('[slot="text-body"]')
			if (textBodyElement) {
				// 提取文本内容，保持段落结构
				const paragraphs = textBodyElement.querySelectorAll('p, li')
				const contentParts: string[] = []
				
				paragraphs.forEach(p => {
					const text = p.textContent?.trim()
					if (text) {
						contentParts.push(text)
					}
				})
				
				content = contentParts.join('\n\n')
			}

			if (!content) {
				content = '无内容或内容无法提取'
			}

			// 提取评论（暂时返回空数组，因为评论结构可能需要单独处理）
			const comments: any[] = []

			return {
				title,
				author,
				subreddit: subredditName,
				publishTime,
				upvotes: score,
				commentCount,
				content,
				comments,
				url: window.location.href
			}
		})
	}

	/**
	 * 将 Reddit 内容格式化为 Markdown
	 */
	private formatToMarkdown(postContent: RedditPostContent): string {
		let markdown = ''

		// 标题
		markdown += `# ${postContent.title}\n\n`

		// 元信息
		markdown += `**来源**: Reddit - r/${postContent.subreddit}\n`
		markdown += `**作者**: u/${postContent.author}\n`
		markdown += `**发布时间**: ${postContent.publishTime}\n`
		markdown += `**赞数**: ${postContent.upvotes} | **评论数**: ${postContent.commentCount}\n`
		markdown += `**链接**: ${postContent.url}\n\n`

		markdown += `---\n\n`

		// 帖子内容
		markdown += `## 帖子内容\n\n`
		markdown += `${postContent.content}\n\n`

		// 评论部分
		if (postContent.comments.length > 0) {
			markdown += `## 热门评论\n\n`
			
			postContent.comments.forEach((comment, index) => {
				markdown += `### 评论 ${index + 1}\n\n`
				markdown += `**作者**: u/${comment.author} | **赞数**: ${comment.upvotes} | **时间**: ${comment.publishTime}\n\n`
				markdown += `${comment.content}\n\n`
				markdown += `---\n\n`
			})
		}

		return markdown
	}

	/**
	 * 延迟函数
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}

	/**
	 * 清理资源
	 */
	async cleanup(): Promise<void> {
		// 不需要关闭浏览器，由 UrlContentFetcher 管理
	}
} 