import * as vscode from "vscode"
import { BrowserSession } from "../BrowserSession"

// 知乎搜索结果接口
export interface ZhihuAnswer {
	questionTitle: string
	questionUrl: string
	author: string
	authorUrl?: string
	content: string
	answerUrl?: string
	likeCount: string
	commentCount: string
	publishTime: string
	comments: ZhihuComment[]
}

export interface ZhihuComment {
	author: string
	authorLink?: string
	content: string
	likeCount: string
	time: string
}

export interface ZhihuSearchResponse {
	success: boolean
	error?: string
	results: ZhihuAnswer[]
	meta: {
		total_results: number
		query: string
	}
}

/**
 * 知乎搜索器
 * 专门用于搜索知乎平台的问答和评论
 */
export class ZhihuSearcher {
	private context: vscode.ExtensionContext
	private browserSession: BrowserSession

	constructor(context: vscode.ExtensionContext) {
		this.context = context
		this.browserSession = new BrowserSession(context)
	}

	/**
	 * 检查是否启用了预登录功能
	 */
	private isPreLoginEnabled(): boolean {
		return this.context.globalState.get("preLoginBrowserEnabled") as boolean ?? false
	}

	/**
	 * 执行知乎搜索
	 */
	async search(query: string, maxResults: number = 10, needAuthorUrl: boolean = false): Promise<ZhihuSearchResponse> {
		if (!query || String(query).trim() === '') {
			console.error('[ZhihuSearcher] 搜索查询不能为空')
			return { 
				success: false, 
				error: '搜索查询不能为空',
				results: [],
				meta: { total_results: 0, query: query }
			}
		}

		const finalMaxResults = maxResults
		
		console.log(`[ZhihuSearcher] 执行知乎搜索: "${query}", 最大结果数: ${finalMaxResults}`)

		const searchUrl = `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(query)}`
		let operationError: string | undefined

		try {
			// 启动浏览器（会自动检测预登录状态并使用相应的用户数据目录）
			// 知乎搜索时显示浏览器窗口以便调试
			await this.browserSession.launchBrowser(false)

			console.log(`[ZhihuSearcher] 导航到知乎搜索页: ${searchUrl}`)
			await this.browserSession.navigateToUrl(searchUrl)

			// 等待页面加载
			await this.delay(2000 + Math.random() * 1000)

			// 等待用户登录完成，反复检查页面内容
			let hasContent = false
			let checkCount = 0
			const maxChecks = 60 // 最多检查60次，每次等待5秒，总共5分钟
			
			console.log('[ZhihuSearcher] 开始等待页面内容加载（如需登录请在浏览器窗口中完成登录）...')
			
			while (!hasContent && checkCount < maxChecks) {
				checkCount++
				
				await this.browserSession.doAction(async (page) => {
					hasContent = await page.evaluate(() => {
						const searchMain = document.getElementById('SearchMain')
						const listItems = searchMain ? searchMain.querySelectorAll('.List-item') : []
						return listItems.length > 0
					})
				})
				
				if (!hasContent) {
					console.log(`[ZhihuSearcher] 第${checkCount}次检查: 页面无内容，等待3秒后重试... (可能需要登录)`)
					await this.delay(5000)
				} else {
					console.log(`[ZhihuSearcher] 第${checkCount}次检查: 检测到页面内容，继续执行搜索`)
				}
			}
			
			if (!hasContent) {
				throw new Error(`等待${maxChecks * 3}秒后仍未检测到页面内容，可能需要登录或页面加载失败`)
			}

			// 执行搜索和提取
			const results = await this.extractSearchResults(finalMaxResults, needAuthorUrl)

			return {
				success: true,
				results: results,
				meta: { 
					total_results: results.length, 
					query: query 
				}
			}

		} catch (err) {
			console.error(`[ZhihuSearcher] 搜索过程中发生错误:`, err)
			operationError = err instanceof Error ? err.message : String(err)
			
			return {
				success: false,
				error: operationError,
				results: [],
				meta: { total_results: 0, query: query }
			}
		} finally {
			// 确保关闭浏览器
			await this.browserSession.closeBrowser()
		}
	}

	/**
	 * 提取搜索结果
	 */
	private async extractSearchResults(maxResults: number, needAuthorUrl: boolean): Promise<ZhihuAnswer[]> {
		let results: ZhihuAnswer[] = []
		await this.browserSession.doAction(async (page) => {
			results = await page.evaluate(async (maxResults: number, needAuthorUrl: boolean) => {
				console.log('开始提取知乎搜索结果，最大结果数:', maxResults)
				
				// 辅助函数：等待指定时间
				const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
				
				// 辅助函数：滚动到指定元素
				const scrollToElement = async (element: HTMLElement, options: any = {}) => {
					if (!element) return false
					
					const defaultOptions = { 
						behavior: 'smooth', 
						block: 'center', 
						waitTime: 1000 
					}
					
					const opts = { ...defaultOptions, ...options }
					
					try {
						element.scrollIntoView({
							behavior: opts.behavior,
							block: opts.block
						})
						
						await wait(opts.waitTime)
						return true
					} catch (error) {
						console.error('滚动到元素时出错:', error)
						return false
					}
				}
				
				// 辅助函数：展开长回答并提取内容和链接
				const expandAndExtractAnswer = async (answerDiv: HTMLElement) => {
					try {
						if (!answerDiv) return { content: '', answerUrl: '' }
						
						const contentDiv = answerDiv.querySelector('.RichContent-inner') as HTMLElement
						if (!contentDiv) return { content: '', answerUrl: '' }
						
						// 尝试展开长回答
						const expandButton = contentDiv.querySelector('button') as HTMLButtonElement
						if (expandButton) {
							console.log('找到展开按钮，点击展开回答')
							await scrollToElement(expandButton)
							expandButton.click()
							await wait(1000)
						}
						
						// 提取内容
						const newContentDiv = answerDiv.querySelector('.RichContent-inner') as HTMLElement
						if (!newContentDiv) return { content: '', answerUrl: '' }
						const content = newContentDiv.textContent?.trim() || ''
						
						// 提取回答链接
						let answerUrl = ''
						const timeDiv = answerDiv.querySelector('.ContentItem-time') as HTMLElement
						if (timeDiv) {
							const linkA = timeDiv.querySelector('a') as HTMLAnchorElement
							if (linkA && linkA.href) {
								answerUrl = linkA.href
							}
						}
						
						return { content, answerUrl }
					} catch (error) {
						console.error('展开回答并提取内容时出错:', error)
						return { content: '', answerUrl: '' }
					}
				}
				
				// 辅助函数：提取回答中的评论
				const extractComments = async (answerDiv: HTMLElement, commentButton: HTMLButtonElement) => {
					try {
						if (!answerDiv || !commentButton) return []
						
						// 检查是否有评论
						const commentText = commentButton.textContent?.trim() || ''
						if (!commentText.includes('条')) {
							console.log('该回答没有评论')
							return []
						}
						
						// 点击评论按钮展开评论
						console.log('点击评论按钮')
						commentButton.click()
						
						// 等待评论加载
						await wait(500)
						
						// 查找评论容器
						const commentsContainer = answerDiv.querySelector('.Comments-container') as HTMLElement
						if (!commentsContainer) {
							console.log('未找到评论容器')
							return []
						}
						
						// 提取评论信息
						const commentDivs = commentsContainer.querySelectorAll('div[data-id]')
						console.log(`找到 ${commentDivs.length} 条评论`)
						
						const comments: any[] = Array.from(commentDivs).map(div => {
							try {
								// 找到作者信息
								const authorLink = div.querySelector('a[href] img') ? 
											div.querySelector('a[href] img')?.closest('a') as HTMLAnchorElement : null
								
								const authorName = authorLink?.querySelector('img')?.getAttribute('alt') || '未知用户'
								const authorUrl = authorLink?.href || ''
								
								// 评论内容
								const contentDiv = div.querySelector('.CommentContent') as HTMLElement
								const content = contentDiv?.textContent?.trim() || ''
								
								// 评论点赞数
								const likeButton = div.querySelector('.Button--grey') as HTMLElement
								const likeCount = likeButton?.textContent?.trim() || '0'
								
								// 评论时间
								let commentTime = ''
								const spans = Array.from(div.querySelectorAll('span'))
								for (const span of spans) {
									const text = span.textContent?.trim() || ''
									if (text.includes('-') || text.includes('小时前') || text.includes('分钟前') || 
										text.includes('天前') || text.includes('月前') || text.includes('年前')) {
										commentTime = text
										break
									}
								}
								
								const result: any = {
									author: authorName,
									content: content,
									likeCount: likeCount,
									time: commentTime
								}
								
								if (needAuthorUrl && authorUrl) {
									result.authorLink = authorUrl
								}
								
								return result
							} catch (err) {
								console.error('提取评论出错:', err)
								return { 
									author: '提取出错', 
									content: '提取评论信息时出错' 
								}
							}
						})
						
						return comments
					} catch (error) {
						console.error('提取评论过程出错:', error)
						return []
					}
				}
				
				try {
					// 先滚动到顶部
					window.scrollTo(0, 0)
					await wait(1000)
					
					const results: any[] = []
					let noNewResultsCount = 0
					
					// 先加载足够的元素
					let answerItemCount = 0
					let answerItemCountLast = 0
					while(answerItemCount < maxResults && noNewResultsCount < 3) {
						// 获取SearchMain容器
						const searchMain = document.getElementById('SearchMain')
						if (!searchMain) {
							console.error('没有找到SearchMain容器')
							break
						}
						
						// 获取回答列表
						const listDiv = searchMain.querySelector('.List') as HTMLElement
						if (!listDiv) {
							console.error('没有找到List容器')
							break
						}
						
						// 获取所有回答项
						const listItems = listDiv.querySelectorAll('.List-item')
						console.log('当前页面回答数量:', listItems.length)
						
						answerItemCount = listItems.length
						if (answerItemCountLast === answerItemCount) {
							noNewResultsCount++
							console.log(`没有新的结果，计数: ${noNewResultsCount}/3`)
						} else {
							noNewResultsCount = 0
						}
						answerItemCountLast = answerItemCount

						if(answerItemCount >= maxResults) {
							break
						}

						// 滚动到页面底部加载更多结果
						const currentHeight = document.body.scrollHeight
						window.scrollTo(0, currentHeight)
						await wait(1000)
					}
					
					// 重新获取最新的元素
					const searchMain = document.getElementById('SearchMain')
					const listDiv = searchMain?.querySelector('.List') as HTMLElement
					const listItems = listDiv?.querySelectorAll('.List-item')
					
					if (!listItems) {
						console.error('无法获取回答列表')
						return results
					}
					
					console.log('开始处理回答，总数:', listItems.length)
					
					// 处理每个回答
					for (let i = 0; i < listItems.length && results.length < maxResults; i++) {
						const answerDiv = listItems[i] as HTMLElement
						
						try {
							// 检查是否有问题标题
							const titleH2 = answerDiv.querySelector('.ContentItem-title') as HTMLElement
							if (!titleH2) continue
							
							const questionMeta = titleH2.querySelector('meta[itemprop="name"]') as HTMLMetaElement
							const questionUrlMeta = titleH2.querySelector('meta[itemprop="url"]') as HTMLMetaElement
							
							if (!questionMeta || !questionUrlMeta) {
								console.log('没有找到问题元数据，跳过')
								continue
							}

							const questionTitle = questionMeta.getAttribute('content') || ''
							const questionUrl = questionUrlMeta.getAttribute('content') || ''
							
							// 滚动到回答
							console.log(`处理第 ${i + 1} 个回答: ${questionTitle}`)
							await scrollToElement(answerDiv)
							
							// 提取作者信息
							const authorInfoDiv = answerDiv.querySelector('.AuthorInfo') as HTMLElement
							let authorName = '未知用户'
							let authorUrl = ''
							
							if (authorInfoDiv) {
								const authorNameMeta = authorInfoDiv.querySelector('meta[itemprop="name"]') as HTMLMetaElement
								const authorUrlMeta = authorInfoDiv.querySelector('meta[itemprop="url"]') as HTMLMetaElement
								
								if (authorNameMeta) {
									authorName = authorNameMeta.getAttribute('content') || '未知用户'
								}
								
								if (authorUrlMeta) {
									authorUrl = authorUrlMeta.getAttribute('content') || ''
								}
							}
							
							// 提取点赞数、评论数和时间
							const actionDiv = answerDiv.querySelector('div[class*="ContentItem-action"]') as HTMLElement
							let likeCount = '0'
							let commentCount = '0'
							let publishTime = ''
							let commentButton: HTMLButtonElement | null = null
							
							if (actionDiv) {
								const likeButton = actionDiv.querySelector('.VoteButton--up') as HTMLElement
								if (likeButton) {
									likeCount = likeButton.textContent?.trim() || '0'
								}
								
								// 找到评论按钮
								const buttons = Array.from(actionDiv.querySelectorAll('button'))
								for (const button of buttons) {
									if (button.className.includes('ContentItem-action') && 
										button.className.includes('Button--plain') && 
										button.className.includes('Button--withIcon') && 
										button.className.includes('Button--withLabel')) {
										commentCount = button.textContent?.trim() || '0'
										commentButton = button as HTMLButtonElement
										break
									}
								}
								
								// 提取发布时间
								const timeSpan = actionDiv.querySelector('span[class*="ContentItem-action"][class*="SearchItem-time"]') as HTMLElement
								if (timeSpan) {
									publishTime = timeSpan.textContent?.trim() || ''
								}
							}

							// 提取评论
							let comments: any[] = []
							if (commentButton) {
								comments = await extractComments(answerDiv, commentButton)
							}

							// 展开回答并提取内容和链接
							const { content, answerUrl } = await expandAndExtractAnswer(answerDiv)
							
							// 收集结果
							const result: any = {
								questionTitle,
								questionUrl,
								author: authorName,
								content,
								likeCount,
								commentCount,
								publishTime,
								comments
							}
							
							if (needAuthorUrl && authorUrl) {
								result.authorUrl = authorUrl
							}
							
							if (answerUrl) {
								result.answerUrl = answerUrl
							}
							
							results.push(result)
							console.log(`已添加第 ${results.length} 个结果`)
							
							// 如果已收集到足够的结果，就停止处理
							if (results.length >= maxResults) break
						} catch (itemError) {
							console.error(`处理第 ${i + 1} 个回答时出错:`, itemError)
						}
					}
					
					console.log(`总共提取了 ${results.length} 个结果`)
					return results
				} catch (error) {
					console.error('执行提取脚本出错:', error)
					return []
				}
			}, maxResults, needAuthorUrl)
		})

		return results
	}

	/**
	 * 延迟工具函数
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
} 