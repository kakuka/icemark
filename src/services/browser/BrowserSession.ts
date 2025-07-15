import * as vscode from "vscode"
import { Browser, Page, ScreenshotOptions, TimeoutError, connect, KnownDevices } from "puppeteer-core"
import pWaitFor from "p-wait-for"
import delay from "delay"
import { BrowserActionResult } from "../../shared/ExtensionMessage"
import { discoverChromeHostUrl, tryChromeHostUrl } from "./browserDiscovery"
import { ChromiumDownloadService, PCRStats } from "./ChromiumDownloadService"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"

export class BrowserSession {
	private context: vscode.ExtensionContext
	private browser?: Browser
	private page?: Page
	private currentMousePosition?: string
	private lastConnectionAttempt?: number
	private chromiumService: ChromiumDownloadService
	private tempUserDataDir?: string

	constructor(context: vscode.ExtensionContext) {
		this.context = context
		this.chromiumService = new ChromiumDownloadService(context)
	}

	private async ensureChromiumExists(): Promise<PCRStats> {
		return this.chromiumService.ensureChromiumExists()
	}

	/**
	 * Gets the viewport size from global state or returns null for browser default
	 */
	private getViewport() {
		const size = this.context.globalState.get("browserViewportSize") as string | undefined
		if (!size) {
			return null // Use browser default
		}
		const [width, height] = size.split("x").map(Number)
		return { width, height }
	}

	/**
	 * Launches a local browser instance
	 * @param headless 是否无头模式，默认为true
	 */
	private async launchLocalBrowser(headless: boolean = true): Promise<void> {
		console.log(`Launching local browser (headless: ${headless})`)
		const stats = await this.ensureChromiumExists()

		// Check if pre-login functionality is enabled
		const preLoginEnabled = this.context.globalState.get("preLoginBrowserEnabled") as boolean

		const launchOptions: any = {
			headless: headless,
			executablePath: stats.executablePath,
			defaultViewport: null,
			ignoreDefaultArgs: ["--enable-automation", "defaultViewport"],
			args: [
				"--no-first-run",
				"--no-default-browser-check",
				"--disable-features=VizDisplayCompositor",
				"--disable-infobars",
				"--disable-extensions",
			],
		}

		// If pre-login is enabled, use the same user data directory as the pre-login browser
		if (preLoginEnabled) {
			const { PreLoginBrowser } = await import("../browser/PreLoginBrowser")
			const preLoginBrowser = new PreLoginBrowser(this.context)
			launchOptions.userDataDir = preLoginBrowser.getUserProfilePath()
			console.log(`BrowserSession: Using pre-login user data directory: ${launchOptions.userDataDir}`)
		}

		this.browser = await stats.puppeteer.launch(launchOptions)

		// 如果是显示模式，添加反检测代码
		if (!headless) {
			this.browser.on("targetcreated", async (target) => {
				const page = await target.page()
				if (page) {
					// 在页面加载前执行反检测脚本
					await page.evaluateOnNewDocument(() => {
						// 移除webdriver属性
						Object.defineProperty(navigator, "webdriver", {
							get: () => undefined,
						})

						// 伪造chrome对象
						;(window as any).chrome = {
							runtime: {},
						}

						// 伪造permissions查询
						const originalQuery = window.navigator.permissions.query
						;(window.navigator.permissions as any).query = (parameters: any) =>
							parameters.name === "notifications"
								? Promise.resolve({ state: Notification.permission } as any)
								: originalQuery(parameters)

						// 伪造插件数量
						Object.defineProperty(navigator, "plugins", {
							get: () => [1, 2, 3, 4, 5],
						})

						// 伪造语言
						Object.defineProperty(navigator, "languages", {
							get: () => ["zh-CN", "zh", "en"],
						})
					})
				}
			})
		}
	}

	/**
	 * Connects to a browser using a WebSocket URL
	 */
	private async connectWithChromeHostUrl(chromeHostUrl: string): Promise<boolean> {
		try {
			this.browser = await connect({
				browserURL: chromeHostUrl,
				// 不设置defaultViewport，让浏览器使用默认尺寸
			})

			// Cache the successful endpoint
			console.log(`Connected to remote browser at ${chromeHostUrl}`)
			this.context.globalState.update("cachedChromeHostUrl", chromeHostUrl)
			this.lastConnectionAttempt = Date.now()

			return true
		} catch (error) {
			console.log(`Failed to connect using WebSocket endpoint: ${error}`)
			return false
		}
	}

	/**
	 * Attempts to connect to a remote browser using various methods
	 * Returns true if connection was successful, false otherwise
	 */
	private async connectToRemoteBrowser(): Promise<boolean> {
		let remoteBrowserHost = this.context.globalState.get("remoteBrowserHost") as string | undefined
		let reconnectionAttempted = false

		// Try to connect with cached endpoint first if it exists and is recent (less than 1 hour old)
		const cachedChromeHostUrl = this.context.globalState.get("cachedChromeHostUrl") as string | undefined
		if (cachedChromeHostUrl && this.lastConnectionAttempt && Date.now() - this.lastConnectionAttempt < 3_600_000) {
			console.log(`Attempting to connect using cached Chrome Host Url: ${cachedChromeHostUrl}`)
			if (await this.connectWithChromeHostUrl(cachedChromeHostUrl)) {
				return true
			}

			console.log(`Failed to connect using cached Chrome Host Url: ${cachedChromeHostUrl}`)
			// Clear the cached endpoint since it's no longer valid
			this.context.globalState.update("cachedChromeHostUrl", undefined)

			// User wants to give up after one reconnection attempt
			if (remoteBrowserHost) {
				reconnectionAttempted = true
			}
		}

		// If user provided a remote browser host, try to connect to it
		else if (remoteBrowserHost && !reconnectionAttempted) {
			console.log(`Attempting to connect to remote browser at ${remoteBrowserHost}`)
			try {
				const hostIsValid = await tryChromeHostUrl(remoteBrowserHost)

				if (!hostIsValid) {
					throw new Error("Could not find chromeHostUrl in the response")
				}

				console.log(`Found WebSocket endpoint: ${remoteBrowserHost}`)

				if (await this.connectWithChromeHostUrl(remoteBrowserHost)) {
					return true
				}
			} catch (error) {
				console.error(`Failed to connect to remote browser: ${error}`)
				// Fall back to auto-discovery if remote connection fails
			}
		}

		try {
			console.log("Attempting browser auto-discovery...")
			const chromeHostUrl = await discoverChromeHostUrl()

			if (chromeHostUrl && (await this.connectWithChromeHostUrl(chromeHostUrl))) {
				return true
			}
		} catch (error) {
			console.error(`Auto-discovery failed: ${error}`)
			// Fall back to local browser if auto-discovery fails
		}

		return false
	}

	async launchBrowser(headless: boolean = true): Promise<void> {
		console.log("launch browser called")

		// Check if remote browser connection is enabled
		const remoteBrowserEnabled = this.context.globalState.get("remoteBrowserEnabled") as boolean | undefined

		if (!remoteBrowserEnabled) {
			console.log("Launching local browser")
			if (this.browser) {
				// throw new Error("Browser already launched")
				await this.closeBrowser() // this may happen when the model launches a browser again after having used it already before
			} else {
				// If browser wasn't open, just reset the state
				this.resetBrowserState()
			}
			await this.launchLocalBrowser(headless)
		} else {
			console.log("Connecting to remote browser")
			// Remote browser connection is enabled
			const remoteConnected = await this.connectToRemoteBrowser()

			// If all remote connection attempts fail, fall back to local browser
			if (!remoteConnected) {
				console.log("Falling back to local browser")
				await this.launchLocalBrowser(headless)
			}
		}
	}

	/**
	 * Closes the browser and resets browser state
	 */
	async closeBrowser(): Promise<BrowserActionResult> {
		if (this.browser || this.page) {
			console.log("closing browser...")

			const remoteBrowserEnabled = this.context.globalState.get("remoteBrowserEnabled") as boolean | undefined
			if (remoteBrowserEnabled && this.browser) {
				await this.browser.disconnect().catch(() => {})
			} else {
				await this.browser?.close().catch(() => {})
				this.resetBrowserState()
			}

			// this.resetBrowserState()
		}
		return {}
	}

	/**
	 * Resets all browser state variables
	 */
	private resetBrowserState(): void {
		this.browser = undefined
		this.page = undefined
		this.currentMousePosition = undefined
	}

	async doAction(action: (page: Page) => Promise<void>): Promise<BrowserActionResult> {
		if (!this.page) {
			throw new Error(
				"Browser is not launched. This may occur if the browser was automatically closed by a non-`browser_action` tool.",
			)
		}

		const logs: string[] = []
		let lastLogTs = Date.now()

		const consoleListener = (msg: any) => {
			if (msg.type() === "log") {
				logs.push(msg.text())
			} else {
				logs.push(`[${msg.type()}] ${msg.text()}`)
			}
			lastLogTs = Date.now()
		}

		const errorListener = (err: Error) => {
			logs.push(`[Page Error] ${err.toString()}`)
			lastLogTs = Date.now()
		}

		// Add the listeners
		this.page.on("console", consoleListener)
		this.page.on("pageerror", errorListener)

		try {
			await action(this.page)
		} catch (err) {
			if (!(err instanceof TimeoutError)) {
				logs.push(`[Error] ${err.toString()}`)
			}
		}

		// Wait for console inactivity, with a timeout
		await pWaitFor(() => Date.now() - lastLogTs >= 500, {
			timeout: 3_000,
			interval: 100,
		}).catch(() => {})

		let options: ScreenshotOptions = {
			encoding: "base64",

			// clip: {
			// 	x: 0,
			// 	y: 0,
			// 	width: 900,
			// 	height: 600,
			// },
		}

		let screenshotBase64 = await this.page.screenshot({
			...options,
			type: "webp",
			quality: ((await this.context.globalState.get("screenshotQuality")) as number | undefined) ?? 75,
		})
		let screenshot = `data:image/webp;base64,${screenshotBase64}`

		if (!screenshotBase64) {
			console.log("webp screenshot failed, trying png")
			screenshotBase64 = await this.page.screenshot({
				...options,
				type: "png",
			})
			screenshot = `data:image/png;base64,${screenshotBase64}`
		}

		if (!screenshotBase64) {
			throw new Error("Failed to take screenshot.")
		}

		// this.page.removeAllListeners() <- causes the page to crash!
		this.page.off("console", consoleListener)
		this.page.off("pageerror", errorListener)

		return {
			screenshot,
			logs: logs.join("\n"),
			currentUrl: this.page.url(),
			currentMousePosition: this.currentMousePosition,
		}
	}

	/**
	 * Extract the root domain from a URL
	 * e.g., http://localhost:3000/path -> localhost:3000
	 * e.g., https://example.com/path -> example.com
	 */
	private getRootDomain(url: string): string {
		try {
			const urlObj = new URL(url)
			// Remove www. prefix if present
			return urlObj.host.replace(/^www\./, "")
		} catch (error) {
			// If URL parsing fails, return the original URL
			return url
		}
	}

	/**
	 * Navigate to a URL with standard loading options
	 */
	private async navigatePageToUrl(page: Page, url: string): Promise<void> {
		await page.goto(url, { timeout: 7_000, waitUntil: ["domcontentloaded", "networkidle2"] })
		await this.waitTillHTMLStable(page)
	}

	/**
	 * Creates a new tab and navigates to the specified URL
	 */
	private async createNewTab(url: string): Promise<BrowserActionResult> {
		if (!this.browser) {
			throw new Error("Browser is not launched")
		}

		// Create a new page
		const newPage = await this.browser.newPage()

		// Set the new page as the active page
		this.page = newPage

		// Navigate to the URL
		const result = await this.doAction(async (page) => {
			await this.navigatePageToUrl(page, url)
		})

		return result
	}

	async navigateToUrl(url: string): Promise<BrowserActionResult> {
		if (!this.browser) {
			throw new Error("Browser is not launched")
		}
		// Remove trailing slash for comparison
		const normalizedNewUrl = url.replace(/\/$/, "")

		// Extract the root domain from the URL
		const rootDomain = this.getRootDomain(normalizedNewUrl)

		// Get all current pages
		const pages = await this.browser.pages()

		// Try to find a page with the same root domain
		let existingPage: Page | undefined

		for (const page of pages) {
			try {
				const pageUrl = page.url()
				if (pageUrl && this.getRootDomain(pageUrl) === rootDomain) {
					existingPage = page
					break
				}
			} catch (error) {
				// Skip pages that might have been closed or have errors
				console.log(`Error checking page URL: ${error}`)
				continue
			}
		}

		if (existingPage) {
			// Tab with the same root domain exists, switch to it
			console.log(`Tab with domain ${rootDomain} already exists, switching to it`)

			// Update the active page
			this.page = existingPage
			existingPage.bringToFront()

			// Navigate to the new URL if it's different]
			const currentUrl = existingPage.url().replace(/\/$/, "") // Remove trailing / if present
			if (this.getRootDomain(currentUrl) === rootDomain && currentUrl !== normalizedNewUrl) {
				console.log(`Navigating to new URL: ${normalizedNewUrl}`)
				console.log(`Current URL: ${currentUrl}`)
				console.log(`Root domain: ${this.getRootDomain(currentUrl)}`)
				console.log(`New URL: ${normalizedNewUrl}`)
				// Navigate to the new URL
				return this.doAction(async (page) => {
					await this.navigatePageToUrl(page, normalizedNewUrl)
				})
			} else {
				console.log(`Tab with domain ${rootDomain} already exists, and URL is the same: ${normalizedNewUrl}`)
				// URL is the same, just reload the page to ensure it's up to date
				console.log(`Reloading page: ${normalizedNewUrl}`)
				console.log(`Current URL: ${currentUrl}`)
				console.log(`Root domain: ${this.getRootDomain(currentUrl)}`)
				console.log(`New URL: ${normalizedNewUrl}`)
				return this.doAction(async (page) => {
					await page.reload({ timeout: 7_000, waitUntil: ["domcontentloaded", "networkidle2"] })
					await this.waitTillHTMLStable(page)
				})
			}
		} else {
			// No tab with this root domain exists, create a new one
			console.log(`No tab with domain ${rootDomain} exists, creating a new one`)
			return this.createNewTab(normalizedNewUrl)
		}
	}

	// page.goto { waitUntil: "networkidle0" } may not ever resolve, and not waiting could return page content too early before js has loaded
	// https://stackoverflow.com/questions/52497252/puppeteer-wait-until-page-is-completely-loaded/61304202#61304202
	private async waitTillHTMLStable(page: Page, timeout = 5_000) {
		const checkDurationMsecs = 500 // 1000
		const maxChecks = timeout / checkDurationMsecs
		let lastHTMLSize = 0
		let checkCounts = 1
		let countStableSizeIterations = 0
		const minStableSizeIterations = 3

		while (checkCounts++ <= maxChecks) {
			let html = await page.content()
			let currentHTMLSize = html.length

			// let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length)
			console.log("last: ", lastHTMLSize, " <> curr: ", currentHTMLSize)

			if (lastHTMLSize !== 0 && currentHTMLSize === lastHTMLSize) {
				countStableSizeIterations++
			} else {
				countStableSizeIterations = 0 //reset the counter
			}

			if (countStableSizeIterations >= minStableSizeIterations) {
				console.log("Page rendered fully...")
				break
			}

			lastHTMLSize = currentHTMLSize
			await delay(checkDurationMsecs)
		}
	}

	/**
	 * Handles mouse interaction with network activity monitoring
	 */
	private async handleMouseInteraction(
		page: Page,
		coordinate: string,
		action: (x: number, y: number) => Promise<void>,
	): Promise<void> {
		const [x, y] = coordinate.split(",").map(Number)

		// Set up network request monitoring
		let hasNetworkActivity = false
		const requestListener = () => {
			hasNetworkActivity = true
		}
		page.on("request", requestListener)

		// Perform the mouse action
		await action(x, y)
		this.currentMousePosition = coordinate

		// Small delay to check if action triggered any network activity
		await delay(100)

		if (hasNetworkActivity) {
			// If we detected network activity, wait for navigation/loading
			await page
				.waitForNavigation({
					waitUntil: ["domcontentloaded", "networkidle2"],
					timeout: 7000,
				})
				.catch(() => {})
			await this.waitTillHTMLStable(page)
		}

		// Clean up listener
		page.off("request", requestListener)
	}

	async click(coordinate: string): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			await this.handleMouseInteraction(page, coordinate, async (x, y) => {
				await page.mouse.click(x, y)
			})
		})
	}

	async type(text: string): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			await page.keyboard.type(text)
		})
	}

	/**
	 * Scrolls the page by the specified amount
	 */
	private async scrollPage(page: Page, direction: "up" | "down"): Promise<void> {
		const viewport = this.getViewport()
		const height = viewport ? viewport.height : 600 // Use default scroll height if no viewport set
		const scrollAmount = direction === "down" ? height : -height

		await page.evaluate((scrollHeight) => {
			window.scrollBy({
				top: scrollHeight,
				behavior: "auto",
			})
		}, scrollAmount)

		await delay(300)
	}

	async scrollDown(): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			await this.scrollPage(page, "down")
		})
	}

	async scrollUp(): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			await this.scrollPage(page, "up")
		})
	}

	async hover(coordinate: string): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			await this.handleMouseInteraction(page, coordinate, async (x, y) => {
				await page.mouse.move(x, y)
				// Small delay to allow any hover effects to appear
				await delay(300)
			})
		})
	}

	async resize(size: string): Promise<BrowserActionResult> {
		return this.doAction(async (page) => {
			const [width, height] = size.split(",").map(Number)
			const session = await page.createCDPSession()
			await page.setViewport({ width, height })
			const { windowId } = await session.send("Browser.getWindowForTarget")
			await session.send("Browser.setWindowBounds", {
				bounds: { width, height },
				windowId,
			})
		})
	}

	/**
	 * Launches a temporary browser instance specifically for prototype display
	 * Creates a temporary user data directory that gets cleaned up when browser closes
	 * @param headless 是否无头模式，默认为false（显示浏览器）
	 */
	async launchTempBrowser(headless: boolean = false): Promise<void> {
		console.log(`Launching temporary browser for prototype display (headless: ${headless})`)

		// Close existing browser if any
		if (this.browser) {
			await this.closeTempBrowser()
		}

		const stats = await this.ensureChromiumExists()

		// Create temporary user data directory
		this.tempUserDataDir = await this.createTempUserDataDir()
		console.log(`Created temporary user data directory: ${this.tempUserDataDir}`)

		const launchOptions: any = {
			headless: headless,
			executablePath: stats.executablePath,
			userDataDir: this.tempUserDataDir,
			// 显式设置为null以完全禁用viewport约束
			defaultViewport: null,
			ignoreDefaultArgs: ["--enable-automation", "defaultViewport"],
			args: [
				"--no-first-run",
				"--no-default-browser-check",
				"--disable-features=VizDisplayCompositor",
				"--disable-background-timer-throttling",
				"--disable-renderer-backgrounding",
				"--disable-backgrounding-occluded-windows",
				"--disable-infobars",
				"--disable-dev-shm-usage",
			],
		}

		this.browser = await stats.puppeteer.launch(launchOptions)

		console.log("Temporary browser launched successfully")
	}

	/**
	 * Closes the temporary browser and cleans up temporary user data directory
	 */
	async closeTempBrowser(): Promise<BrowserActionResult> {
		if (this.browser || this.page) {
			console.log("Closing temporary browser...")

			try {
				await this.browser?.close().catch(() => {})
				this.resetBrowserState()
			} catch (error) {
				console.error("Error closing browser:", error)
			}

			// Clean up temporary user data directory
			if (this.tempUserDataDir) {
				try {
					await this.cleanupTempUserDataDir()
				} catch (error) {
					console.error("Error cleaning up temporary user data directory:", error)
				}
			}
		}
		return {}
	}

	/**
	 * Creates a temporary user data directory for the browser
	 */
	private async createTempUserDataDir(): Promise<string> {
		const tempDir = os.tmpdir()
		const timestamp = Date.now()
		const randomStr = Math.random().toString(36).substring(2, 8)
		const tempUserDataDir = path.join(tempDir, `icemark-prototype-${timestamp}-${randomStr}`)

		try {
			await fs.mkdir(tempUserDataDir, { recursive: true })
			return tempUserDataDir
		} catch (error) {
			throw new Error(`Failed to create temporary user data directory: ${error}`)
		}
	}

	/**
	 * Cleans up the temporary user data directory
	 */
	private async cleanupTempUserDataDir(): Promise<void> {
		if (!this.tempUserDataDir) {
			return
		}

		try {
			console.log(`Cleaning up temporary user data directory: ${this.tempUserDataDir}`)
			await this.removeDirectory(this.tempUserDataDir)
			this.tempUserDataDir = undefined
			console.log("Temporary user data directory cleaned up successfully")
		} catch (error) {
			console.error(`Failed to cleanup temporary user data directory: ${error}`)
			// Don't throw error, just log it as cleanup failure is not critical
		}
	}

	/**
	 * Recursively removes a directory and all its contents
	 */
	private async removeDirectory(dirPath: string): Promise<void> {
		try {
			const stat = await fs.stat(dirPath)
			if (!stat.isDirectory()) {
				await fs.unlink(dirPath)
				return
			}

			const entries = await fs.readdir(dirPath, { withFileTypes: true })

			for (const entry of entries) {
				const entryPath = path.join(dirPath, entry.name)
				if (entry.isDirectory()) {
					await this.removeDirectory(entryPath)
				} else {
					await fs.unlink(entryPath)
				}
			}

			await fs.rmdir(dirPath)
		} catch (error) {
			// On Windows, files might be locked, retry after a short delay
			if (error.code === "EBUSY" || error.code === "ENOTEMPTY") {
				await delay(500)
				await this.removeDirectory(dirPath)
			} else {
				throw error
			}
		}
	}

	/**
	 * 获取可用的移动设备列表
	 * @returns 返回可用设备名称列表
	 */
	async getAvailableDevices(): Promise<string[]> {
		try {
			// Get available device names from KnownDevices
			const deviceNames = Object.keys(KnownDevices)
			console.log(`Available devices: ${deviceNames.join(", ")}`)
			return deviceNames
		} catch (error) {
			console.warn("Failed to get available devices:", error)
			return []
		}
	}

	/**
	 * Emulates a mobile device for better mobile prototype display
	 * @param deviceName 设备名称，默认为 'iPhone 15 Pro'
	 */
	async emulateMobileDevice(deviceName: string = "iPhone 15 Pro"): Promise<void> {
		if (!this.page) {
			throw new Error("No active page to emulate mobile device")
		}

		try {
			// Get device configuration from KnownDevices
			const device = KnownDevices[deviceName as keyof typeof KnownDevices]

			if (device) {
				// Use Puppeteer's built-in device emulation (official way)
				await this.page.emulate(device)
				console.log(`Mobile device simulation applied successfully: ${deviceName}`)
			} else {
				// List available devices and fallback to iPhone 15 Pro
				const availableDevices = Object.keys(KnownDevices)
				console.warn(`Device '${deviceName}' not found. Available devices: ${availableDevices.join(", ")}`)

				// Try fallback devices
				const fallbackDevice =
					KnownDevices["iPhone 15 Pro"] ||
					KnownDevices["iPhone 14 Pro"] ||
					KnownDevices["iPhone 13 Pro"] ||
					KnownDevices["iPhone 12 Pro"]

				if (fallbackDevice) {
					await this.page.emulate(fallbackDevice)
					console.log("Using fallback device: iPhone Pro series")
				} else {
					// Final fallback to manual configuration
					console.warn("No suitable device found, using manual iPhone configuration")
					await this.page.emulate({
						viewport: {
							width: 393,
							height: 852,
							deviceScaleFactor: 3,
							isMobile: true,
							hasTouch: true,
							isLandscape: false,
						},
						userAgent:
							"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
					})
				}
			}

			// Reload to apply mobile simulation
			await this.page.reload({ waitUntil: ["domcontentloaded", "networkidle2"] })
			console.log("Mobile device simulation applied successfully")
		} catch (error) {
			console.warn("Failed to apply mobile device simulation:", error)
			throw error
		}
	}
}
