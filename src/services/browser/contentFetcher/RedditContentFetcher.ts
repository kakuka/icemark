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
			throw new Error("The provided URL is not a Reddit link")
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
			console.error(`[RedditContentFetcher] Extraction failed:`, error)
			throw new Error(`Reddit content extraction failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * 提取 Reddit 帖子内容
	 */
	private async extractPostContent(): Promise<RedditPostContent> {
		const page = (this.browserSession as any)['page']
		if (!page) {
			throw new Error("Page not initialized")
		}

		// 等待页面内容加载 - 检查是否有 main-content
		try {
			await page.waitForSelector('#main-content', { timeout: 5000 })
		} catch {
			throw new Error("Page content not loaded or not a valid Reddit post page")
		}
		await new Promise(resolve => setTimeout(resolve, 2000))

		return await page.evaluate(() => {
			// 检查是否有内容
			const mainContent = document.querySelector('#main-content')
			if (!mainContent) {
				throw new Error("Main content area not found")
			}

			// 提取标题 - 从 shreddit-title 元素
			const titleElement = document.querySelector('shreddit-title')
			const title = titleElement?.getAttribute('title') || 'Untitled'

			// 提取 shreddit-post 元素获取基本信息
			const postElement = document.querySelector('shreddit-post')
			if (!postElement) {
				throw new Error("Post element not found")
			}

			// 从 shreddit-post 属性中提取信息
			const author = postElement.getAttribute('author') || 'Unknown'
			const subredditName = postElement.getAttribute('subreddit-name') || 'Unknown'
			const commentCount = postElement.getAttribute('comment-count') || '0'
			const score = postElement.getAttribute('score') || '0'
			const createdTimestamp = postElement.getAttribute('created-timestamp') || ''

			// 格式化时间
			let publishTime = 'Unknown time'
			if (createdTimestamp) {
				try {
					const date = new Date(createdTimestamp)
					publishTime = date.toLocaleString('en-US')
				} catch {
					publishTime = createdTimestamp
				}
			}

			// 提取帖子内容 - 从 slot="text-body" 中的内容
			let content = ''
			const textBodyElement = postElement.querySelector('[slot="text-body"]')
			if (textBodyElement) {
				content = textBodyElement.textContent?.trim() || ''
			}

			if (!content) {
				content = 'No content or content could not be extracted'
			}

			// 提取评论
			const comments: any[] = []
			const commentTree = document.querySelector('#comment-tree')
			if (commentTree) {
				// 获取顶级评论（直接子级的 shreddit-comment 元素）
				const topLevelComments = commentTree.querySelectorAll(':scope > shreddit-comment')
				topLevelComments.forEach(commentElement => {
					const comment = extractShredditComment(commentElement)
					if (comment) {
						comments.push(comment)
					}
				})
			}

			// 递归提取 shreddit-comment 的函数
			function extractShredditComment(commentElement: Element): any | null {
				try {
					// 从 shreddit-comment 属性中提取基本信息
					const author = commentElement.getAttribute('author') || 'Anonymous'
					const score = commentElement.getAttribute('score') || '0'
					const thingId = commentElement.getAttribute('thingid') || ''
					const permalink = commentElement.getAttribute('permalink') || ''
					
					// 提取时间信息
					const timeElement = commentElement.querySelector('time')
					const publishTime = timeElement?.getAttribute('title') || 
									   timeElement?.textContent?.trim() || 'Unknown time'

					// 提取评论内容 - 从 slot="comment" 中的内容
					let content = ''
					const commentContentElement = commentElement.querySelector('[slot="comment"]')
					if (commentContentElement) {
						content = commentContentElement.textContent?.trim() || ''
					}

					if (!content) {
						content = 'No content or content could not be extracted'
					}

					// 递归提取子评论
					const replies: any[] = []
					const childComments = commentElement.querySelectorAll(':scope > shreddit-comment')
					childComments.forEach(childComment => {
						const reply = extractShredditComment(childComment)
						if (reply) {
							replies.push(reply)
						}
					})

					return {
						author,
						content,
						upvotes: score,
						publishTime,
						thingId,
						permalink,
						replies: replies.length > 0 ? replies : undefined
					}
				} catch (error) {
					console.error('Error extracting comment:', error)
					return null
				}
			}

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
		markdown += `**Source**: Reddit - r/${postContent.subreddit}\n`
		markdown += `**Author**: u/${postContent.author}\n`
		markdown += `**Posted**: ${postContent.publishTime}\n`
		markdown += `**Upvotes**: ${postContent.upvotes} | **Comments**: ${postContent.commentCount}\n`
		markdown += `**Link**: ${postContent.url}\n\n`

		markdown += `---\n\n`

		// 帖子内容
		markdown += `## Post Content\n\n`
		markdown += `${postContent.content}\n\n`

		// 评论部分
		if (postContent.comments.length > 0) {
			markdown += `## Comments\n\n`
			
			postContent.comments.forEach((comment, index) => {
				markdown += this.formatComment(comment, `${index + 1}`, 0)
			})
		}

		return markdown
	}

	/**
	 * 递归格式化评论为 Markdown
	 */
	private formatComment(comment: RedditComment, commentNumber: string, depth: number): string {
		let markdown = ''
		const indent = '  '.repeat(depth) // 缩进表示层级
		const headerLevel = Math.min(depth + 3, 6) // 限制标题层级最大为 h6
		const headerPrefix = '#'.repeat(headerLevel)

		// 评论标题和元信息
		markdown += `${indent}${headerPrefix} Comment ${commentNumber}\n\n`
		markdown += `${indent}**Author**: u/${comment.author} | **Upvotes**: ${comment.upvotes} | **Time**: ${comment.publishTime}\n\n`
		
		// 评论内容
		const contentLines = comment.content.split('\n')
		contentLines.forEach(line => {
			markdown += `${indent}${line}\n`
		})
		markdown += `\n`

		// 递归处理回复
		if (comment.replies && comment.replies.length > 0) {
			markdown += `${indent}**Replies**:\n\n`
			comment.replies.forEach((reply, replyIndex) => {
				// 构建层次化编号：1 -> 1-1, 1-2, 1-3...
				const replyNumber = `${commentNumber}-${replyIndex + 1}`
				markdown += this.formatComment(reply, replyNumber, depth + 1)
			})
		}

		markdown += `${indent}---\n\n`
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
		// Browser management is handled by UrlContentFetcher
	}
} 