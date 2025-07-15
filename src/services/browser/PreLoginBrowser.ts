import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs"
import { spawn, ChildProcess } from "child_process"
import { ChromiumDownloadService } from "./ChromiumDownloadService"

export class PreLoginBrowser {
	private context: vscode.ExtensionContext
	private chromeProcess?: ChildProcess
	private chromiumService: ChromiumDownloadService

	constructor(context: vscode.ExtensionContext) {
		this.context = context
		this.chromiumService = new ChromiumDownloadService(context)
	}

	/**
	 * Launch a pre-login browser instance with persistent user profile
	 * 直接启动Chrome进程，不通过puppeteer，避免任何检测
	 */
	async launch(): Promise<void> {
		if (this.chromeProcess) {
			console.log("PreLoginBrowser: Browser already launched")
			return
		}

		try {
			console.log("PreLoginBrowser: Launching pre-login browser directly")
			
			// Ensure Chromium exists
			const stats = await this.chromiumService.ensureChromiumExists()
			
			// 指定用户数据目录，这样登录状态可以保存
			const userProfilePath = this.getUserProfilePath()
			const chromeArgs = [
				`--user-data-dir=${userProfilePath}`
			]
			
			console.log(`PreLoginBrowser: Starting Chrome with user data dir: ${userProfilePath}`)
			
			this.chromeProcess = spawn(stats.executablePath, chromeArgs, {
				detached: false,
				stdio: 'ignore'
			})
			
			this.chromeProcess.on('error', (error) => {
				console.error('PreLoginBrowser: Chrome process error:', error)
				this.chromeProcess = undefined
			})
			
			this.chromeProcess.on('exit', (code) => {
				console.log(`PreLoginBrowser: Chrome process exited with code ${code}`)
				this.chromeProcess = undefined
			})
			
			console.log(`PreLoginBrowser: Chrome launched successfully with profile: ${userProfilePath}`)
		} catch (error) {
			console.error("PreLoginBrowser: Failed to launch browser:", error)
			throw error
		}
	}

	/**
	 * Get the user profile path for persistent browser data
	 * This is the directory that should be used by puppeteer for consistent login state
	 */
	getUserProfilePath(): string {
		const globalStoragePath = this.context.globalStorageUri?.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage path is not available")
		}
		
		return path.join(globalStoragePath, "browser-profile")
	}

	/**
	 * Close the pre-login browser
	 */
	async close(): Promise<void> {
		if (this.chromeProcess) {
			console.log("PreLoginBrowser: Closing browser")
			this.chromeProcess.kill()
			this.chromeProcess = undefined
		}
	}

	/**
	 * Clear all browser login data by removing the user profile directory
	 */
	async clearLoginData(): Promise<void> {
		try {
			// Close browser first if it's running
			await this.close()
			
			const userProfilePath = this.getUserProfilePath()
			
			if (fs.existsSync(userProfilePath)) {
				console.log(`PreLoginBrowser: Clearing login data at: ${userProfilePath}`)
				
				// Remove the entire user profile directory
				await fs.promises.rm(userProfilePath, { recursive: true, force: true })
				
				console.log("PreLoginBrowser: Login data cleared successfully")
			} else {
				console.log("PreLoginBrowser: No login data found to clear")
			}
		} catch (error) {
			console.error("PreLoginBrowser: Failed to clear login data:", error)
			throw error
		}
	}
} 