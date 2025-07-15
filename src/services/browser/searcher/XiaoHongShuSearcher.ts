import * as vscode from "vscode"
import { BrowserSession } from "../BrowserSession"

// 小红书搜索结果接口
export interface XiaoHongShuNote {
	title: string
	noteLink: string
	authorName: string
	authorLink?: string
	likeCount: string
	publishTime: string
	detail?: {
		content: string
		likeCount: string
		collectCount: string
		commentCount: string
		comments: XiaoHongShuComment[]
	}
}

export interface XiaoHongShuComment {
	author: string
	authorLink?: string
	content: string
	time: string
	likeCount: string
}

export interface XiaoHongShuSearchResponse {
	success: boolean
	error?: string
	results: XiaoHongShuNote[]
	meta: {
		total_results: number
		query: string
	}
}

/**
 * 小红书搜索器
 * 专门用于搜索小红书平台的笔记和评论
 */
export class XiaoHongShuSearcher {
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
	 * 执行小红书搜索
	 */
	async search(query: string, maxResults: number = 10, needAuthorUrl: boolean = false): Promise<XiaoHongShuSearchResponse> {
		if (!query || String(query).trim() === '') {
			console.error('[XiaoHongShuSearcher] 搜索查询不能为空')
			return { 
				success: false, 
				error: '搜索查询不能为空',
				results: [],
				meta: { total_results: 0, query: query }
			}
		}

		const finalMaxResults = maxResults
		
		console.log(`[XiaoHongShuSearcher] 执行小红书搜索: "${query}", 最大结果数: ${finalMaxResults}`)

		const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_explore_feed`
		let operationError: string | undefined

		try {
			// 启动浏览器（会自动检测预登录状态并使用相应的用户数据目录）
			// 小红书搜索时显示浏览器窗口以便调试
			await this.browserSession.launchBrowser(false)

			console.log(`[XiaoHongShuSearcher] 导航到小红书搜索页: ${searchUrl}`)
			await this.browserSession.navigateToUrl(searchUrl)

			// 等待页面加载
			await this.delay(2000 + Math.random() * 1000)

			// 等待用户登录完成，反复检查页面内容
			let hasContent = false
			let checkCount = 0
			const maxChecks = 60 // 最多检查60次，每次等待5秒，总共5分钟
			
			console.log('[XiaoHongShuSearcher] 开始等待页面内容加载（如需登录请在浏览器窗口中完成登录）...')
			
			while (!hasContent && checkCount < maxChecks) {
				checkCount++
				
				await this.browserSession.doAction(async (page) => {
					hasContent = await page.evaluate(() => {
						const noteItems = document.querySelectorAll('section.note-item')
						return noteItems.length > 0
					})
				})
				
				if (!hasContent) {
					console.log(`[XiaoHongShuSearcher] 第${checkCount}次检查: 页面无内容，等待5秒后重试... (可能需要登录)`)
					await this.delay(5000)
				} else {
					console.log(`[XiaoHongShuSearcher] 第${checkCount}次检查: 检测到页面内容，继续执行搜索`)
				}
			}
			
			if (!hasContent) {
				throw new Error(`等待${maxChecks * 5}秒后仍未检测到页面内容，可能需要登录或页面加载失败`)
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
			console.error(`[XiaoHongShuSearcher] 搜索过程中发生错误:`, err)
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
	private async extractSearchResults(maxResults: number, needAuthorUrl: boolean): Promise<XiaoHongShuNote[]> {
		let results: XiaoHongShuNote[] = []
		await this.browserSession.doAction(async (page) => {
			results = await page.evaluate(async (maxResults: number, needAuthorUrl: boolean) => {
				console.log('开始提取小红书搜索结果，最大结果数:', maxResults)
				
				// 辅助函数：等待指定时间
				const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
				
				// 辅助函数：提取笔记详情
				const extractNoteDetail = async (coverLink: HTMLAnchorElement) => {
					try {
						console.log('准备点击并提取详情:', coverLink.href)
						
						// 点击链接打开详情
						coverLink.click()
						await wait(1000) // 等待详情加载
						
						// 获取详情容器
						const noteContainer = document.querySelector('#noteContainer.note-container') as HTMLElement
						if (!noteContainer) {
							console.error('找不到笔记容器 #noteContainer.note-container')
							return null
						}
						
						// 提取笔记内容
						const noteContent = noteContainer.querySelector('.note-content') as HTMLElement
						const content = noteContent ? noteContent.textContent?.trim() || '' : ''
						
						// 提取互动数据
						const likeWrapper = noteContainer.querySelector('.like-wrapper.like-active') as HTMLElement
						const likeCount = likeWrapper ? likeWrapper.textContent?.trim() || '0' : '0'
						
						const collectSpan = noteContainer.querySelector('#note-page-collect-board-guide') as HTMLElement
						const collectCount = collectSpan ? collectSpan.textContent?.trim() || '0' : '0'
						
						// 提取评论
						const commentsContainer = noteContainer.querySelector('.comments-container') as HTMLElement
						let commentCount = '0'
						let comments: any[] = []
						
						if (commentsContainer) {
							const totalDiv = commentsContainer.querySelector('.total') as HTMLElement
							commentCount = totalDiv ? totalDiv.textContent?.trim() || '0' : '0'
							
							// 滚动加载评论
							for (let i = 0; i < 3; i++) {
								const parentComments = commentsContainer.querySelectorAll('.parent-comment')
								if (parentComments.length === 0) break
								
								const lastComment = parentComments[parentComments.length - 1] as HTMLElement
								lastComment.scrollIntoView({ behavior: 'smooth' })
								await wait(500)
							}
							
							// 收集评论
							const parentComments = commentsContainer.querySelectorAll('.parent-comment')
							comments = Array.from(parentComments).map(comment => {
								try {
									const nameElement = comment.querySelector('.name') as HTMLAnchorElement
									const noteTextElement = comment.querySelector('.note-text') as HTMLElement
									const dateElement = comment.querySelector('.date') as HTMLElement
									const likeElement = comment.querySelector('.like') as HTMLElement
									
									const result: any = {
										author: nameElement ? nameElement.textContent?.trim() || '未知用户' : '未知用户',
										content: noteTextElement ? noteTextElement.textContent?.trim() || '' : '',
										time: dateElement ? dateElement.textContent?.trim() || '' : '',
										likeCount: likeElement ? likeElement.textContent?.trim() || '0' : '0'
									}
									
									if (needAuthorUrl && nameElement?.href) {
										result.authorLink = nameElement.href
									}
									
									return result
								} catch (err) {
									console.error('提取评论出错:', err)
									return { author: '提取出错', content: '提取评论信息时出错' }
								}
							})
						}
						
						// 关闭详情页
						const closeButton = document.querySelector('.close-circle') as HTMLElement
						if (closeButton) {
							closeButton.click()
							await wait(500)
						} else {
							console.error('找不到关闭按钮')
						}
						
						return {
							content,
							likeCount,
							collectCount,
							commentCount,
							comments
						}
					} catch (error) {
						console.error('提取笔记详情出错:', error)
						
						// 尝试关闭可能已打开的详情页
						try {
							const closeButton = document.querySelector('.close-circle') as HTMLElement
							if (closeButton) closeButton.click()
						} catch (e) {}
						
						return null
					}
				}
				
				// 开始滚动加载结果
				try {
					// 首先滚动到顶部
					window.scrollTo(0, 0)
					await wait(500)
					
					const results: any[] = []
					let lastHeight = 0
					let sameHeightCount = 0
					let scrollCount = 0
					
					// 滚动直到找到足够的结果或已无更多结果
					while (results.length < maxResults && scrollCount < 20 && sameHeightCount < 3) {
						// 获取当前可见的笔记项
						const noteItems = document.querySelectorAll('section.note-item')
						console.log('当前找到笔记项数量:', noteItems.length)
						
						if (noteItems.length === 0) {
							console.error('没有找到任何笔记项，页面可能未正确加载')
							// 尝试向下滚动一点，看是否能触发加载
							window.scrollBy(0, 300)
							await wait(2000)
							continue
						}
						
						// 收集基本信息
						for (let i = 0; i < noteItems.length && results.length < maxResults; i++) {
							const item = noteItems[i]
							try {
								// 检查这个项是否已经处理过
								const titleElement = item.querySelector('a.title') as HTMLAnchorElement
								const title = titleElement ? titleElement.textContent?.trim() || '' : ''
								
								const isProcessed = results.some(r => r.title === title)
								
								if (!isProcessed && titleElement) {
									// 提取基本信息
									const authorElement = item.querySelector('a.author') as HTMLAnchorElement
									const likeCountElement = item.querySelector('span.count') as HTMLElement
									const timeElement = item.querySelector('span.time') as HTMLElement
									const coverLink = item.querySelector('a.cover.mask.ld') as HTMLAnchorElement
									
									// 必须要有标题和封面链接
									if (titleElement && coverLink) {
										// 将项滚动到视图中
										item.scrollIntoView({ behavior: 'smooth', block: 'center' })
										await wait(500)
										
										// 基本信息
										const result: any = {
											title: title,
											authorName: authorElement?.querySelector('.name')?.textContent?.trim() || '未知作者',
											likeCount: likeCountElement?.textContent?.trim() || '0',
											publishTime: timeElement?.textContent?.trim() || '未知时间',
											noteLink: coverLink.href,
											detail: null
										}
										
										if (needAuthorUrl && authorElement?.href) {
											result.authorLink = authorElement.href
										}
										
										console.log(`提取第 ${results.length + 1} 个结果基本信息: ${result.title}`)
										
										// 提取详情
										console.log(`开始提取第 ${results.length + 1} 个结果的详情`)
										const detail = await extractNoteDetail(coverLink)
										if (detail) {
											result.detail = detail
											console.log(`成功提取第 ${results.length + 1} 个结果的详情`)
										} else {
											console.log(`提取第 ${results.length + 1} 个结果的详情失败`)
										}
										
										results.push(result)
									}
								}
							} catch (err) {
								console.error('处理笔记项时出错:', err)
							}
							
							// 如果已收集到足够的结果，提前结束
							if (results.length >= maxResults) break
						}
						
						// 如果已收集到足够的结果，提前结束
						if (results.length >= maxResults) break
						
						// 继续滚动加载更多结果
						const currentHeight = document.body.scrollHeight
						window.scrollTo(0, currentHeight)
						
						scrollCount++
						await wait(1000)
						
						// 检查是否已经到底
						if (currentHeight === lastHeight) {
							sameHeightCount++
						} else {
							sameHeightCount = 0
							lastHeight = currentHeight
						}
					}
					
					console.log(`总共提取了 ${results.length} 条结果`)
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