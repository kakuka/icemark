import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { BaseEngine } from "./BaseEngine"
import { PrototypeResult } from "../types"

export class MarkdownEngine extends BaseEngine {
	async init(pathParam: string, _args: any = {}): Promise<PrototypeResult> {
		try {
			const fullPath = path.resolve(this.workspacePath, pathParam)
			
			// 确保目录存在
			await fs.mkdir(path.dirname(fullPath), { recursive: true })
			
			// 检查文件是否已存在
			try {
				await fs.access(fullPath)
				return {
					success: false,
					message: `Markdown file already exists: ${pathParam}`,
				}
			} catch (error) {
				// 文件不存在，继续创建
			}
			
			// 创建初始Markdown文件
			const defaultMarkdownContent = ``
			
			await fs.writeFile(fullPath, defaultMarkdownContent)
			
			const message = `Successfully created Markdown file: ${pathParam}\n` +
				`File path: ${fullPath}\n` +
				`File name: ${path.basename(fullPath)}\n` +
				`Type: Markdown document\n` +
				`Initial content: Basic Markdown template with Chinese content`
			
			return {
				success: true,
				message: message,
			}
		} catch (error) {
			return this.handleError("create Markdown file", error)
		}
	}

	async show(pathParam: string, _args: any = {}): Promise<PrototypeResult> {
		try {
			const fullPath = path.resolve(this.workspacePath, pathParam)

			// 检查文件是否存在
			try {
				await fs.access(fullPath)
			} catch (error) {
				return {
					success: false,
					message: `Markdown file not found: ${pathParam}`,
				}
			}

			// 生成唯一的文件ID
			const fileId = this.generateFileId(fullPath)

			// 创建Express应用
			const app = this.createExpressApp()
			
			// 设置路由
			const markdownAssetsPath = this.context.asAbsolutePath(path.join("assets", "markdown"))
			app.use('/assets', require('express').static(path.join(markdownAssetsPath, 'assets')))
			
			app.get('/', (_req: any, res: any) => {
				res.sendFile(path.join(markdownAssetsPath, 'index.html'))
			})
			
			// 设置文件信息路由
			this.setupFileInfoRoute(app)
			
			// 获取文件内容
			app.get('/file/:fileId', async (req: any, res: any) => {
				try {
					const fileId = req.params.fileId
					const filePath = this.getFilePathById(fileId)
					
					if (!filePath) {
						console.error('File ID not found:', fileId)
						return res.status(404).json({ error: 'File not found' })
					}
					
									console.log('Loading Markdown file:', filePath)
				const markdownContent = await fs.readFile(filePath, 'utf8')
				
				// 添加Last-Modified头和缓存控制头
				const modificationTime = await this.getFileModificationTime(filePath)
				res.set('Last-Modified', new Date(modificationTime).toUTCString())
				res.set('Cache-Control', 'no-cache, must-revalidate')
				res.set('Pragma', 'no-cache')
				res.set('Expires', '0')
				
				res.json({ markdownContent })
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					console.error('Load error:', errorMessage, error)
					res.status(500).json({ 
						error: 'Failed to load file: ' + errorMessage,
						details: error instanceof Error ? error.stack : undefined
					})
				}
			})
			
			// 保存文件的API端点
			app.post('/save/:fileId', async (req: any, res: any) => {
				try {
					const fileId = req.params.fileId
					const filePath = this.getFilePathById(fileId)
					
					if (!filePath) {
						console.error('File ID not found:', fileId)
						return res.status(404).json({ error: 'File not found' })
					}
					
					const markdownContent = req.body.markdownContent
					if (!markdownContent || typeof markdownContent !== 'string') {
						console.error('Invalid markdown content received:', typeof markdownContent)
						return res.status(400).json({ error: 'Invalid markdown content format' })
					}
					
					console.log('Saving Markdown file:', filePath)
					
					// 确保目录存在
					const dir = path.dirname(filePath)
					await fs.mkdir(dir, { recursive: true })
					
					await fs.writeFile(filePath, markdownContent)
					console.log('Markdown file saved successfully:', filePath)
					res.json({ success: true, message: 'Markdown file saved successfully' })
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					console.error('Save error:', errorMessage, error)
					res.status(500).json({ 
						error: 'Failed to save markdown file: ' + errorMessage,
						details: error instanceof Error ? error.stack : undefined
					})
				}
			})

			// 保存截图的API端点
			app.post('/save-screenshot/:fileId', require('express').raw({ type: 'application/octet-stream', limit: '50mb' }), async (req: any, res: any) => {
				try {
					const fileId = req.params.fileId
					const filePath = this.getFilePathById(fileId)
					
					if (!filePath) {
						console.error('File ID not found:', fileId)
						return res.status(404).json({ error: 'File not found' })
					}
					
					// 生成带时间戳的截图文件名
					const now = new Date()
					const year = now.getFullYear()
					const month = String(now.getMonth() + 1).padStart(2, '0')
					const day = String(now.getDate()).padStart(2, '0')
					const hour = String(now.getHours()).padStart(2, '0')
					const minute = String(now.getMinutes()).padStart(2, '0')
					const second = String(now.getSeconds()).padStart(2, '0')
					const timestamp = `${year}-${month}-${day}_${hour}-${minute}-${second}`
					
					// 生成带时间戳的文件名
					const baseFileName = path.basename(filePath, path.extname(filePath))
					const screenshotFileName = `${baseFileName}-${timestamp}.png`
					const screenshotPath = path.join(path.dirname(filePath), screenshotFileName)
					console.log('Saving screenshot:', screenshotPath)
					
					if (!req.body || !Buffer.isBuffer(req.body)) {
						console.error('Invalid request body - not a buffer')
						return res.status(400).json({ error: 'Invalid request body: expected binary data' })
					}
					
					// 确保目录存在
					const dir = path.dirname(screenshotPath)
					await fs.mkdir(dir, { recursive: true })
					
					await fs.writeFile(screenshotPath, req.body)
					console.log('Screenshot saved successfully:', screenshotPath)
					
					res.json({ 
						success: true, 
						message: 'Screenshot saved successfully',
						path: screenshotPath,
						size: req.body.length
					})
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					console.error('Screenshot save error:', errorMessage, error)
					res.status(500).json({ 
						error: 'Failed to save screenshot: ' + errorMessage,
						details: error instanceof Error ? error.stack : undefined
					})
				}
			})

			// 通配符路由处理 markdown 中引用的本地资源文件（放在最后作为 fallback）
			app.get('*', async (req: any, res: any, next: any) => {
				try {
					// 检查是否是资源文件请求（通过文件扩展名判断）
					if (req.path.match(/\.(png|jpg|jpeg|gif|svg|pdf|md|mmd|css|js|ico|txt|doc|docx|webp|bmp|tiff|mp4|mp3|wav|json|xml|csv|zip|rar|7z)$/i)) {
						const filePath = this.getFilePathById(fileId)
						
						if (!filePath) {
							console.log('File ID not found for resource request:', req.path)
							return res.status(404).send('File not found')
						}
						
						// 获取 markdown 文件所在的目录
						const markdownDir = path.dirname(filePath)
						
						// 构建请求的文件完整路径
						// 去掉开头的 / 并处理 ./ 相对路径
						const relativePath = req.path.replace(/^\/+/, '').replace(/^\.\//, '')
						const requestedFile = path.resolve(markdownDir, relativePath)
						
						console.log('Resource request:', {
							requestPath: req.path,
							markdownDir: markdownDir,
							relativePath: relativePath,
							requestedFile: requestedFile
						})
						
						// 安全检查：确保请求的文件在 markdown 文件所在目录及其子目录中
						if (!requestedFile.startsWith(path.resolve(markdownDir))) {
							console.log('Security check failed: file outside allowed directory')
							return res.status(403).send('Access denied')
						}
						
						// 检查文件是否存在
						try {
							await fs.access(requestedFile)
							console.log('Serving resource file:', requestedFile)
							return res.sendFile(requestedFile)
						} catch (error) {
							console.log('Resource file not found:', requestedFile)
							return res.status(404).send('Resource not found')
						}
					}
					
					// 不是资源文件请求，继续到下一个路由处理器
					next()
				} catch (error) {
					console.error('Resource serving error:', error)
					next()
				}
			})

			// 启动服务器
			const { port, server } = await this.startHttpServer(app)
			
			// 服务器关闭时清理文件映射
			server.on('close', () => {
				this.clearFileId(fileId)
			})
			
			const viewerUrl = `http://localhost:${port}/?file=${encodeURIComponent(fileId)}`

			// Open in external browser
			await vscode.env.openExternal(vscode.Uri.parse(viewerUrl))

			return {
				success: true,
				message: this.generateSuccessMessage(
					pathParam,
					fullPath,
					viewerUrl,
					port,
					"Markdown editor",
					["Real-time editing", "syntax highlighting", "auto-save", "screenshot export", "file change monitoring"]
				),
			}
		} catch (error) {
			return this.handleError("show Markdown file", error)
		}
	}
} 