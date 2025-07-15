import * as vscode from "vscode"
import * as cheerio from "cheerio"
import TurndownService from "turndown"
import { BrowserSession } from "./BrowserSession"

export class UrlContentFetcher {
	private context: vscode.ExtensionContext
	private browserSession: BrowserSession
	private isLaunched: boolean = false

	constructor(context: vscode.ExtensionContext) {
		this.context = context
		this.browserSession = new BrowserSession(context)
	}

	/**
	 * 启动浏览器 - 保持兼容性的API
	 * 内部使用BrowserSession，享受预登录、反检测等高级功能
	 */
	async launchBrowser(): Promise<void> {
		if (this.isLaunched) {
			return
		}
		
		console.log("UrlContentFetcher: 启动浏览器，使用BrowserSession管理")
		// 使用headless模式启动浏览器，自动获得预登录、反检测等功能
		await this.browserSession.launchBrowser(true)
		this.isLaunched = true
	}

	/**
	 * 关闭浏览器 - 保持兼容性的API
	 */
	async closeBrowser(): Promise<void> {
		if (this.isLaunched) {
			await this.browserSession.closeBrowser()
			this.isLaunched = false
		}
	}

	/**
	 * 将URL内容转换为Markdown格式
	 * must make sure to call launchBrowser before and closeBrowser after using this
	 */
	async urlToMarkdown(url: string): Promise<string> {
		if (!this.isLaunched) {
			throw new Error("Browser not initialized")
		}
		console.log("UrlContentFetcher: 将URL内容转换为Markdown格式")
		
		let markdown = ''
		
		// 使用BrowserSession导航到URL（这会创建页面）
		await this.browserSession.navigateToUrl(url)
		
		// 通过BrowserSession执行页面操作
		await this.browserSession.doAction(async (page) => {
			// 等待额外的网络活动完成，确保页面完全加载
			/*
			- BrowserSession.navigateToUrl已经处理了基本的页面加载
			- 这里稍微等待一下确保动态内容也加载完成
			*/
			await new Promise(resolve => setTimeout(resolve, 1000))
			
			const content = await page.content()

			// use cheerio to parse and clean up the HTML
			const $ = cheerio.load(content)
			$("script, style, nav, footer, header").remove()

			// convert cleaned HTML to markdown
			const turndownService = new TurndownService()
			markdown = turndownService.turndown($.html())
		})

		return markdown
	}

	/**
	 * Clean up resources
	 */
	async cleanup(): Promise<void> {
		await this.closeBrowser()
	}
}
