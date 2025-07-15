import * as vscode from "vscode"
import { BrowserSession } from "../BrowserSession"

// 微博搜索结果接口
export interface WeiboPost {
	author: string
	authorLink?: string
	publishTime: string
	weiboLink: string
	content: string
	repostCount: string
	commentCount: string
	likeCount: string
	comments: WeiboComment[]
}

export interface WeiboComment {
	author: string
	authorLink?: string
	content: string
	time: string
}

export interface WeiboSearchResponse {
	success: boolean
	error?: string
	results: WeiboPost[]
	meta: {
		total_results: number
		query: string
	}
}

/**
 * 微博搜索器
 * 专门用于搜索微博平台的内容和评论
 */
export class WeiboSearcher {
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
	 * 执行微博搜索
	 */
	async search(query: string, maxResults: number = 20, needAuthorUrl: boolean = false): Promise<WeiboSearchResponse> {
		if (!query || String(query).trim() === '') {
			console.error('[WeiboSearcher] 搜索查询不能为空')
			return { 
				success: false, 
				error: '搜索查询不能为空',
				results: [],
				meta: { total_results: 0, query: query }
			}
		}

		const finalMaxResults = maxResults
		
		console.log(`[WeiboSearcher] 执行微博搜索: "${query}", 最大结果数: ${finalMaxResults}`)

		let operationError: string | undefined

		try {
			// 启动浏览器（会自动检测预登录状态并使用相应的用户数据目录）
			// 微博搜索时显示浏览器窗口以便调试
			await this.browserSession.launchBrowser(false)

			// 执行多页搜索和提取
			const results = await this.extractMultiPageResults(query, finalMaxResults, needAuthorUrl)

			return {
				success: true,
				results: results,
				meta: { 
					total_results: results.length, 
					query: query 
				}
			}

		} catch (err) {
			console.error(`[WeiboSearcher] 搜索过程中发生错误:`, err)
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
	 * 提取多页搜索结果
	 */
	private async extractMultiPageResults(query: string, maxResults: number, needAuthorUrl: boolean): Promise<WeiboPost[]> {
		const allResults: WeiboPost[] = []
		let currentPage = 1
		const maxPages = 10 // 最多爬取10页

		while (allResults.length < maxResults && currentPage <= maxPages) {
			const searchUrl = `https://s.weibo.com/weibo?q=${encodeURIComponent(query)}&page=${currentPage}`
			console.log(`[WeiboSearcher] 正在加载第 ${currentPage} 页: ${searchUrl}`)

			try {
				// 导航到搜索页面
				await this.browserSession.navigateToUrl(searchUrl)

				// 等待页面加载
				await this.delay(2000 + Math.random() * 1000)

				// 等待用户登录完成，反复检查页面内容
				let hasContent = false
				let checkCount = 0
				const maxChecks = 60 // 最多检查60次，每次等待5秒，总共5分钟
				
				console.log(`[WeiboSearcher] 第${currentPage}页：开始等待页面内容加载（如需登录请在浏览器窗口中完成登录）...`)
				
				while (!hasContent && checkCount < maxChecks) {
					checkCount++
					
					await this.browserSession.doAction(async (page) => {
						hasContent = await page.evaluate(() => {
							const weiboItems = document.querySelectorAll('div[action-type="feed_list_item"]')
							return weiboItems.length > 0
						})
					})
					
					// 检查是否为无搜索结果页面
					if (!hasContent && checkCount >= 2) {
						const isNoResults = await this.checkIfNoSearchResults()
						if (isNoResults) {
							console.log(`[WeiboSearcher] 第${currentPage}页检测到无搜索结果页面，生成提示记录`)
							const noResultRecord = this.createNoResultsRecord(query)
							allResults.push(noResultRecord)
							return allResults
						}
					}
					
					if (!hasContent) {
						console.log(`[WeiboSearcher] 第${currentPage}页第${checkCount}次检查: 页面无内容，等待3秒后重试... (可能需要登录)`)
						await this.delay(5000)
					} else {
						console.log(`[WeiboSearcher] 第${currentPage}页第${checkCount}次检查: 检测到页面内容，开始提取`)
					}
				}
				
				if (!hasContent) {
					console.log(`[WeiboSearcher] 第${currentPage}页等待${maxChecks * 3}秒后仍未检测到内容，跳过此页`)
					currentPage++
					continue
				}

				// 执行当前页面的内容提取
				const pageResults = await this.extractCurrentPageContent(needAuthorUrl)

				// 将当前页结果添加到总结果中
				if (pageResults && pageResults.length > 0) {
					console.log(`[WeiboSearcher] 第 ${currentPage} 页成功提取 ${pageResults.length} 条微博`)
					allResults.push(...pageResults)
					
					// 如果已经获取到足够的结果，就提前结束
					if (allResults.length >= maxResults) {
						// 截断结果至最大数量
						if (allResults.length > maxResults) {
							allResults.splice(maxResults)
						}
						break
					}
				} else {
					console.log(`[WeiboSearcher] 第 ${currentPage} 页未提取到任何微博`)
				}

				// 检查是否存在下一页
				let hasNextPage = false
				await this.browserSession.doAction(async (page) => {
					hasNextPage = await page.evaluate(() => {
						const pageDiv = document.querySelector('div.m-page')
						if (!pageDiv) return false
						
						const nextLink = pageDiv.querySelector('a.next')
						return !!nextLink
					})
				})

				if (!hasNextPage) {
					console.log(`[WeiboSearcher] 未找到下一页按钮，已到达最后一页，停止爬取`)
					break
				}

				// 进入下一页
				currentPage++

			} catch (pageError) {
				console.error(`[WeiboSearcher] 处理第 ${currentPage} 页时出错:`, pageError)
				// 尝试继续处理下一页
				currentPage++
			}
		}

		console.log(`[WeiboSearcher] 所有页面共成功获取 ${allResults.length} 条结果`)
		return allResults
	}

	/**
	 * 提取当前页面的微博内容
	 */
	private async extractCurrentPageContent(needAuthorUrl: boolean): Promise<WeiboPost[]> {
		let results: WeiboPost[] = []
		await this.browserSession.doAction(async (page) => {
			results = await page.evaluate(async (needAuthorUrl: boolean) => {
				console.log('开始提取当前页面的微博内容')
				
				// 辅助函数：等待指定时间
				const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
				
				// 辅助函数：滚动到指定元素
				const scrollToElement = async (element: HTMLElement) => {
					if (!element) return
					
					// 滚动到元素
					element.scrollIntoView({ behavior: 'smooth', block: 'center' })
					
					// 等待滚动和元素加载完成
					await wait(500)
					
					// 检查元素是否在可视区域内
					const rect = element.getBoundingClientRect()
					const isInViewport = (
						rect.top >= 0 &&
						rect.left >= 0 &&
						rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
						rect.right <= (window.innerWidth || document.documentElement.clientWidth)
					)
					
					// 如果不在可视区域内，再次尝试滚动
					if (!isInViewport) {
						console.log('元素不在可视区域内，尝试再次滚动')
						element.scrollIntoView({ behavior: 'smooth', block: 'center' })
						await wait(100)
					}
					
					return true
				}
				
				// 辅助函数：提取微博评论
				const extractComments = async (commentTrigger: HTMLAnchorElement) => {
					try {
						if (!commentTrigger) return []
						
						// 确保评论触发器在视图中
						await scrollToElement(commentTrigger)
						
						// 点击评论链接展开评论区
						commentTrigger.click()
						await wait(1000) // 等待评论加载
						
						// 查找评论所在的父级元素
						const feedItem = commentTrigger.closest('div[action-type="feed_list_item"]') as HTMLElement
						if (!feedItem) return []
						
						// 查找评论列表容器
						const commentListDiv = feedItem.querySelector('div[node-type="feed_list_commentList"]') as HTMLElement
						if (!commentListDiv) {
							console.log('未找到评论列表容器')
							return []
						}
						
						// 滚动到评论列表区域
						await scrollToElement(commentListDiv)
						
						// 查找所有评论项
						const commentItems = commentListDiv.querySelectorAll('div[comment_id]')
						if (!commentItems || commentItems.length === 0) {
							console.log('未找到评论项')
							return []
						}
						
						// 提取每条评论的信息
						const comments: any[] = Array.from(commentItems).map(item => {
							try {
								// 提取评论者
								const authorElement = item.querySelector('a.name') as HTMLAnchorElement
								const authorName = authorElement ? authorElement.textContent?.trim() || '未知用户' : '未知用户'
								const authorLink = authorElement && authorElement.href ? authorElement.href.replace(/^\/\//, 'https://') : ''
								
								// 提取评论内容
								const contentElement = item.querySelector('div.txt') as HTMLElement
								let content = contentElement ? contentElement.textContent?.trim() || '' : ''
								
								// 移除用户名前缀（如果存在）
								if (content.startsWith(authorName)) {
									content = content.substring(authorName.length).trim()
								}
								// 移除冒号前缀（如果存在）
								if (content.startsWith('：')) {
									content = content.substring(1).trim()
								}
								
								// 提取评论时间
								const timeElement = item.querySelector('p.from') as HTMLElement
								const commentTime = timeElement ? timeElement.textContent?.trim() || '' : ''
								
								const result: any = {
									author: authorName,
									content,
									time: commentTime
								}
								
								if (needAuthorUrl && authorLink) {
									result.authorLink = authorLink
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
					const pageResults: any[] = []
					
					// 先滚动到页面顶部
					window.scrollTo(0, 0)
					await wait(500)
					
					// 获取当前页面上的所有微博项
					const weiboItems = document.querySelectorAll('div[action-type="feed_list_item"]')
					console.log(`当前页面找到微博数量: ${weiboItems.length}`)
					
					if (weiboItems.length === 0) {
						console.log('当前页面未找到微博项')
						return []
					}
					
					// 处理每个微博项
					for (let i = 0; i < weiboItems.length; i++) {
						const item = weiboItems[i] as HTMLElement
						try {
							// 滚动到当前微博，确保元素在视图中并且加载完成
							console.log(`滚动到第 ${i+1} 条微博`)
							await scrollToElement(item)
							
							// 提取作者信息
							const authorElement = item.querySelector('a.name') as HTMLAnchorElement
							const authorName = authorElement ? authorElement.textContent?.trim() || '未知用户' : '未知用户'
							const authorLink = authorElement && authorElement.href ? authorElement.href.replace(/^\/\//, 'https://') : ''
							
							// 提取发布时间和微博链接
							const fromDiv = item.querySelector('div.from') as HTMLElement
							const linkElement = fromDiv ? fromDiv.querySelector('a') as HTMLAnchorElement : null
							const publishTime = linkElement ? linkElement.textContent?.trim() || '' : ''
							const weiboLink = linkElement && linkElement.href ? linkElement.href.replace(/^\/\//, 'https://') : ''
							
							// 提取微博内容
							// 先尝试获取完整内容（长微博）
							let contentElement = item.querySelector('p[node-type="feed_list_content_full"]') as HTMLElement
							// 如果没有完整内容，则获取普通内容
							if (!contentElement) {
								contentElement = item.querySelector('p[node-type="feed_list_content"]') as HTMLElement
							}
							const content = contentElement ? contentElement.textContent?.trim() || '' : ''
							
							// 提取转发、评论、点赞数量
							const cardActDiv = item.querySelector('div.card-act') as HTMLElement
							
							// 再次滚动确保底部互动区域可见
							if (cardActDiv) {
								await scrollToElement(cardActDiv)
							}
							
							const actionItems = cardActDiv ? Array.from(cardActDiv.querySelectorAll('li')) : []
							
							let repostCount = '0'
							let commentCount = '0'
							let likeCount = '0'
							
							if (actionItems.length >= 3) {
								// 第一项是转发
								const repostText = actionItems[0].textContent?.trim() || ''
								const repostMatch = repostText.match(/\d+/)
								repostCount = repostMatch ? repostMatch[0] : '0'
								
								// 第二项是评论
								const commentText = actionItems[1].textContent?.trim() || ''
								const commentMatch = commentText.match(/\d+/)
								commentCount = commentMatch ? commentMatch[0] : '0'
								
								// 第三项是点赞
								const likeText = actionItems[2].textContent?.trim() || ''
								const likeMatch = likeText.match(/\d+/)
								likeCount = likeMatch ? likeMatch[0] : '0'
							}
							
							// 提取评论
							let comments: any[] = []
							if (parseInt(commentCount) > 0) {
								const commentTrigger = actionItems.length >= 2 ? actionItems[1].querySelector('a') as HTMLAnchorElement : null
								if (commentTrigger) {
									console.log(`开始提取第 ${i+1} 条微博的评论`)
									comments = await extractComments(commentTrigger)
									console.log(`提取到 ${comments.length} 条评论`)
								}
							}
							
							// 构建结果对象
							const result: any = {
								author: authorName,
								publishTime,
								weiboLink,
								content,
								repostCount,
								commentCount,
								likeCount,
								comments
							}
							
							if (needAuthorUrl && authorLink) {
								result.authorLink = authorLink
							}
							
							pageResults.push(result)
							console.log(`已提取第 ${pageResults.length} 条微博`)
							
						} catch (err) {
							console.error(`提取第 ${i+1} 条微博出错:`, err)
						}
					}
					
					console.log(`当前页面总共提取了 ${pageResults.length} 条微博`)
					return pageResults
				} catch (error) {
					console.error('提取当前页面微博过程出错:', error)
					return []
				}
			}, needAuthorUrl)
		})

		return results
	}

	/**
	 * 延迟工具函数
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}

	/**
	 * 检查页面是否显示无搜索结果
	 */
	private async checkIfNoSearchResults(): Promise<boolean> {
		let isNoResults = false
		await this.browserSession.doAction(async (page) => {
			isNoResults = await page.evaluate(() => {
				const hotBandTabs = document.querySelector('div.hot-band-tabs')
				return !!hotBandTabs
			})
		})
		return isNoResults
	}

	/**
	 * 创建表示无搜索结果的记录
	 */
	private createNoResultsRecord(query: string): WeiboPost {
		return {
			author: "系统提示",
			publishTime: new Date().toLocaleString(),
			weiboLink: "",
			content: `搜索关键词"${query}"没有找到任何相关的微博内容。建议：1) 检查关键词拼写是否正确；2) 尝试使用其他相关关键词；3) 检查网络连接状态。`,
			repostCount: "0",
			commentCount: "0", 
			likeCount: "0",
			comments: []
		}
	}
} 