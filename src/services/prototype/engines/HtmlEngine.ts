import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { BaseEngine } from "./BaseEngine"
import { PrototypeResult } from "../types"
import { ChromiumDownloadService } from "../../browser/ChromiumDownloadService"

export class HtmlEngine extends BaseEngine {
	async init(pathParam: string, args: any = {}): Promise<PrototypeResult> {
		try {
			const { includeAssets = true } = args
			const fullPath = path.resolve(this.workspacePath, pathParam)
			const isMobile = pathParam.endsWith('-html-mobile')
			
			// 检查项目是否已存在
			try {
				await fs.access(fullPath)
				return {
					success: false,
					message: `HTML project already exists: ${pathParam}`,
				}
			} catch (error) {
				// 项目不存在，继续创建
			}

			// 创建项目目录
			await fs.mkdir(fullPath, { recursive: true })

			// 创建标准目录结构
			const standardDirs = ["assets","images","screenshots"]

			for (const dir of standardDirs) {
				await fs.mkdir(path.join(fullPath, dir), { recursive: true })
			}

			// 复制内置资源
			if (includeAssets) {
				await this.copyBuiltInAssets(fullPath)
			}

			const folderName = path.basename(pathParam)

			// 生成基本的 index.html
			await this.generateIndexHtml(fullPath, path.basename(pathParam), isMobile)

			const projectType = isMobile ? 'mobile' : 'web'
			const assetsInfo = includeAssets ? 'with built-in assets (Bootstrap, AlpineJS, Lucide icons)' : 'without assets'
			const message = `Successfully created HTML ${projectType} project: ${pathParam}\n` +
				`Project path: ${fullPath}\n` +
				`Structure: 
				${folderName}
				- assets/
				- images/
				- screenshots/
				- index.html
				` +
				`Assets: ${assetsInfo}\n` +
				`Entry file: index.html`

			return {
				success: true,
				message: message,
			}
		} catch (error) {
			return this.handleError("create HTML project", error)
		}
	}

	async show(pathParam: string, args: any = {}): Promise<PrototypeResult> {
		try {
			const { file = "index.html" } = args
			const fullPath = path.resolve(this.workspacePath, pathParam)
			const isMobile = pathParam.endsWith('-html-mobile')

			// 检查项目目录是否存在
			try {
				await fs.access(fullPath)
			} catch (error) {
				return {
					success: false,
					message: `HTML project not found: ${pathParam}`,
				}
			}

			// 创建Express应用
			const app = this.createExpressApp()
			
			// 设置路由
			const htmlViewerAssetsPath = this.context.asAbsolutePath(path.join("assets", "html-viewer"))
			
			// 0. 服务HTML查看器的静态资源
			app.use('/assets', require('express').static(path.join(htmlViewerAssetsPath, 'assets')))
			
			// 1. 服务HTML查看器界面
			app.get('/', (_req: any, res: any) => {
				res.sendFile(path.join(htmlViewerAssetsPath, 'index.html'))
			})
			
			// 2. 获取项目文件列表的API
			app.get('/api/files', async (_req: any, res: any) => {
				try {
					const files = await this.getHtmlFiles(fullPath)
					res.json({
						success: true,
						files,
						projectInfo: {
							name: path.basename(fullPath),
							path: fullPath,
							type: isMobile ? 'mobile' : 'web',
							defaultFile: file
						}
					})
				} catch (error) {
					res.status(500).json({
						success: false,
						message: `Failed to get files: ${error instanceof Error ? error.message : String(error)}`
					})
				}
			})
			
			// 3. 预览HTML文件的API
			app.get('/api/preview/:fileName', async (req: any, res: any) => {
				try {
					const fileName = req.params.fileName
					const filePath = path.join(fullPath, fileName)
					
					// 检查文件是否存在
					await fs.access(filePath)
					
					// 读取HTML内容
					let content = await fs.readFile(filePath, 'utf-8')
					
					// 处理相对路径，确保资源能正确加载
					content = this.processHtmlPaths(content, fullPath, fileName)
					
					res.setHeader('Content-Type', 'text/html; charset=utf-8')
					res.send(content)
				} catch (error) {
					res.status(404).send(`<html><body><h1>文件未找到</h1><p>无法找到文件: ${req.params.fileName}</p><p>错误: ${error instanceof Error ? error.message : String(error)}</p></body></html>`)
				}
			})
			
			// 4. 服务HTML项目的静态资源
			app.use('/project-assets', require('express').static(fullPath))
			
			// 5. 截图API
			app.post('/api/screenshot', async (req: any, res: any) => {
				try {
					console.log('Screenshot API called with body:', req.body)
					const { fileName, _type, deviceInfo } = req.body
					if (!fileName) {
						return res.status(400).json({ success: false, message: 'File name is required' })
					}

					// 构造要截图的URL
					const screenshotUrl = `http://localhost:${port}/api/preview/${encodeURIComponent(fileName)}`
					console.log('Screenshot URL:', screenshotUrl)
					
					// 使用puppeteer截图
					const screenshot = await this.takeDeviceScreenshot(screenshotUrl, deviceInfo)
					
					// 生成带时间戳和设备信息的文件名
					const timestamp = this.generateTimestamp()
					const deviceName = deviceInfo?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown'
					const screenshotFileName = `${path.basename(fileName, '.html')}-${deviceName}-${timestamp}.png`
					const screenshotPath = path.join(fullPath, "screenshots", screenshotFileName)
					
					console.log('Saving screenshot to:', screenshotPath)
					
					// 保存截图
					await fs.writeFile(screenshotPath, screenshot)
					
					// 短暂延时确保文件写入完成
					await new Promise(resolve => setTimeout(resolve, 100))
					
					console.log('Screenshot saved successfully')
					res.json({ 
						success: true, 
						message: 'Screenshot saved successfully',
						fileName: screenshotFileName,
						path: screenshotPath,
						deviceInfo: deviceInfo
					})
				} catch (error) {
					console.error('Screenshot API error:', error)
					res.status(500).json({
						success: false,
						message: `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`,
						stack: error instanceof Error ? error.stack : undefined
					})
				}
			})

			// 启动服务器
			const { port } = await this.startHttpServer(app)
			
			const viewerUrl = `http://localhost:${port}/?project=${encodeURIComponent(pathParam)}`
			
			// 在外部浏览器中打开
			await vscode.env.openExternal(vscode.Uri.parse(viewerUrl))

			const projectType = isMobile ? 'mobile' : 'web'
			return {
				success: true,
				message: this.generateSuccessMessage(
					pathParam,
					fullPath,
					viewerUrl,
					port,
					`HTML ${projectType} prototype viewer`,
					["File navigation", "preview", "screenshot support", "responsive design"]
				),
			}
		} catch (error) {
			return this.handleError("show HTML project", error)
		}
	}

	/**
	 * Copy built-in assets to project
	 */
	private async copyBuiltInAssets(projectPath: string): Promise<void> {
		const assetsSourcePath = this.context.asAbsolutePath(path.join("assets", "prototype"))
		const assetsDestPath = path.join(projectPath, "assets")

		try {
			// Check if source assets exist
			await fs.access(assetsSourcePath)

			// Copy all files from source to destination
			await this.copyDirectory(assetsSourcePath, assetsDestPath)
		} catch (error) {
			// If prototype assets don't exist, just create empty directories
			console.warn("Built-in prototype assets not found - please download assets manually")
			await fs.mkdir(path.join(assetsDestPath, "css"), { recursive: true })
			await fs.mkdir(path.join(assetsDestPath, "js"), { recursive: true })
			await fs.mkdir(path.join(assetsDestPath, "icons"), { recursive: true })
		}
	}

	/**
	 * Recursively copy directory
	 */
	private async copyDirectory(src: string, dest: string): Promise<void> {
		await fs.mkdir(dest, { recursive: true })
		const entries = await fs.readdir(src, { withFileTypes: true })

		for (const entry of entries) {
			const srcPath = path.join(src, entry.name)
			const destPath = path.join(dest, entry.name)

			if (entry.isDirectory()) {
				await this.copyDirectory(srcPath, destPath)
			} else {
				await fs.copyFile(srcPath, destPath)
			}
		}
	}

	/**
	 * Generate basic index.html with asset references
	 */
	private async generateIndexHtml(projectPath: string, projectName: string, isMobile: boolean): Promise<void> {
		const htmlContent = this.getBasicTemplate(projectName, isMobile)
		await fs.writeFile(path.join(projectPath, "index.html"), htmlContent)
	}

	/**
	 * Basic HTML Template with asset references
	 */
	private getBasicTemplate(projectName: string, isMobile: boolean): string {
		const viewportContent = isMobile 
			? "width=device-width, initial-scale=1.0, user-scalable=no"
			: "width=device-width, initial-scale=1.0"
		
		const bodyClass = isMobile ? "mobile-prototype" : "web-prototype"
		
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="${viewportContent}">
	<title>${projectName}</title>
	<link rel="stylesheet" href="assets/css/bootstrap.min.css">
	${isMobile ? '<style>body { font-size: 16px; -webkit-text-size-adjust: 100%; }</style>' : ''}
</head>
<body class="${bodyClass}">
	<div class="container${isMobile ? '-fluid' : ''}">
		<h1>Welcome to ${projectName}</h1>
		<p>This is a ${isMobile ? 'mobile' : 'web'} prototype project.</p>
	</div>
	<script defer src="assets/js/alpine.min.js"></script>
	<script src="assets/icons/lucide.min.js"></script>
	<script>
		document.addEventListener('DOMContentLoaded', () => {
			if (typeof lucide !== 'undefined') {
				lucide.createIcons();
			}
		});
	</script>
</body>
</html>`
	}

	/**
	 * Get HTML files in the project directory
	 */
	private async getHtmlFiles(projectPath: string): Promise<Array<{name: string, fullPath: string, size: number}>> {
		const files = []
		
		try {
			const entries = await fs.readdir(projectPath, { withFileTypes: true })
			
			for (const entry of entries) {
				if (entry.isFile() && entry.name.endsWith('.html')) {
					const filePath = path.join(projectPath, entry.name)
					const stat = await fs.stat(filePath)
					files.push({
						name: entry.name,
						fullPath: filePath,
						size: stat.size
					})
				}
			}
		} catch (error) {
			console.error('Error reading HTML files:', error)
		}
		
		return files
	}

	/**
	 * Process HTML paths to ensure resources load correctly
	 */
	private processHtmlPaths(content: string, _projectPath: string, _fileName: string): string {
		// 简单粗暴的方法：替换所有相对路径
		
		// 处理 src 属性（图片、脚本等）
		content = content.replace(/\bsrc\s*=\s*["']([^"']+)["']/gi, (match, url) => {
			// 跳过绝对路径和特殊协议
			if (url.startsWith('http') || url.startsWith('https') || 
				url.startsWith('data:') || url.startsWith('//') || 
				url.startsWith('/') || url.startsWith('#')) {
				return match
			}
			
			// 清理相对路径
			const cleanUrl = url.replace(/^\.\//, '').replace(/^(\.\.\/)+/, '')
			const quote = match.includes('"') ? '"' : "'"
			return `src=${quote}/project-assets/${cleanUrl}${quote}`
		})
		
		// 处理 href 属性（CSS、链接等）
		content = content.replace(/\bhref\s*=\s*["']([^"']+)["']/gi, (match, url) => {
			// 跳过绝对路径和特殊协议
			if (url.startsWith('http') || url.startsWith('https') || 
				url.startsWith('data:') || url.startsWith('//') || 
				url.startsWith('/') || url.startsWith('#') ||
				url.startsWith('mailto:') || url.startsWith('tel:')) {
				return match
			}
			
			// 清理相对路径
			const cleanUrl = url.replace(/^\.\//, '').replace(/^(\.\.\/)+/, '')
			const quote = match.includes('"') ? '"' : "'"
			return `href=${quote}/project-assets/${cleanUrl}${quote}`
		})
		
		// 处理CSS中的url()
		content = content.replace(/url\s*\(\s*["']?([^"')\s]+)["']?\s*\)/gi, (match, url) => {
			// 跳过绝对路径和特殊协议
			if (url.startsWith('http') || url.startsWith('https') || 
				url.startsWith('data:') || url.startsWith('//') || 
				url.startsWith('/')) {
				return match
			}
			
			// 清理相对路径
			const cleanUrl = url.replace(/^\.\//, '').replace(/^(\.\.\/)+/, '')
			return `url("/project-assets/${cleanUrl}")`
		})
		
		return content
	}

	/**
	 * Take device-specific screenshot using puppeteer
	 */
	private async takeDeviceScreenshot(url: string, deviceInfo: any): Promise<Buffer> {
		console.log('Starting screenshot capture for URL:', url, 'with device info:', deviceInfo)
		
		// Use existing ChromiumDownloadService to ensure browser is available
		const chromiumService = new ChromiumDownloadService(this.context)
		const stats = await chromiumService.ensureChromiumExists()
		
		console.log('Chromium ensured, launching browser...')
		
		const browser = await stats.puppeteer.launch({
			headless: true,
			executablePath: stats.executablePath,
			args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-features=VizDisplayCompositor']
		})
		
		try {
			const page = await browser.newPage()
			
			console.log('Setting viewport:', { 
				width: deviceInfo.width || 1920, 
				height: deviceInfo.height || 1080,
				device: deviceInfo.device 
			})
			
			// 设置viewport为用户当前选择的设备尺寸
			await page.setViewport({
				width: deviceInfo.width || 1920,
				height: deviceInfo.height || 1080,
				deviceScaleFactor: 2, // 高清截图
				isMobile: deviceInfo.device === 'phone', // 移动端模式
				hasTouch: deviceInfo.device === 'phone' || deviceInfo.device === 'pad'
			})
			
			// 如果是移动设备，设置User-Agent
			if (deviceInfo.device === 'phone') {
				await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1')
			} else if (deviceInfo.device === 'pad') {
				await page.setUserAgent('Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1')
			}
			
			console.log('Navigating to URL:', url)
			await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
			
			console.log('Taking screenshot...')
			// 截图整个页面，但使用当前设备的viewport
			const screenshot = await page.screenshot({
				type: 'png',
				fullPage: true, // 截图完整页面内容
			})
			
			console.log('Screenshot captured successfully, size:', screenshot.length, 'bytes')
			return Buffer.from(screenshot)
		} catch (error) {
			console.error('Screenshot capture failed:', error)
			throw error
		} finally {
			await browser.close()
			console.log('Browser closed')
		}
	}

	/**
	 * Generate timestamp string for file naming
	 */
	private generateTimestamp(): string {
		const now = new Date()
		const year = now.getFullYear()
		const month = String(now.getMonth() + 1).padStart(2, '0')
		const day = String(now.getDate()).padStart(2, '0')
		const hour = String(now.getHours()).padStart(2, '0')
		const minute = String(now.getMinutes()).padStart(2, '0')
		const second = String(now.getSeconds()).padStart(2, '0')
		
		return `${year}-${month}-${day}_${hour}-${minute}-${second}`
	}
} 