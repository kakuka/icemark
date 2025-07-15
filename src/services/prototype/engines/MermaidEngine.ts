import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { BaseEngine } from "./BaseEngine"
import { PrototypeResult } from "../types"

export class MermaidEngine extends BaseEngine {
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
					message: `Mermaid file already exists: ${pathParam}`,
				}
			} catch (error) {
				// 文件不存在，继续创建
			}
			
			// 创建初始Mermaid文件
			const defaultMermaidCode = ``
			
			await fs.writeFile(fullPath, defaultMermaidCode)
			
			const message = `Successfully created Mermaid file: ${pathParam}\n` +
				`File path: ${fullPath}\n` +
				`File name: ${path.basename(fullPath)}\n` +
				`Type: Mermaid diagram\n` +
				`Initial content: Basic flowchart template with Chinese labels`
			
			return {
				success: true,
				message: message,
			}
		} catch (error) {
			return this.handleError("create Mermaid file", error)
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
					message: `Mermaid file not found: ${pathParam}`,
				}
			}

			// 生成唯一的文件ID
			const fileId = this.generateFileId(fullPath)

			// 创建Express应用
			const app = this.createExpressApp()
			
			// 设置路由
			const mermaidAssetsPath = this.context.asAbsolutePath(path.join("assets", "mermaid"))
			app.use('/assets', require('express').static(path.join(mermaidAssetsPath, 'assets')))
			
			app.get('/', (_req: any, res: any) => {
				res.sendFile(path.join(mermaidAssetsPath, 'index.html'))
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
					
					console.log('Loading Mermaid file:', filePath)
					const mermaidCode = await fs.readFile(filePath, 'utf8')
					
					// 添加Last-Modified头
					const modificationTime = await this.getFileModificationTime(filePath)
					res.set('Last-Modified', new Date(modificationTime).toUTCString())
					
					res.json({ mermaidCode })
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
					
					const mermaidCode = req.body.mermaidCode
					if (!mermaidCode || typeof mermaidCode !== 'string') {
						console.error('Invalid mermaid code received:', typeof mermaidCode)
						return res.status(400).json({ error: 'Invalid mermaid code format' })
					}
					
					console.log('Saving Mermaid file:', filePath)
					
					// 确保目录存在
					const dir = path.dirname(filePath)
					await fs.mkdir(dir, { recursive: true })
					
					await fs.writeFile(filePath, mermaidCode)
					console.log('Mermaid file saved successfully:', filePath)
					res.json({ success: true, message: 'Mermaid file saved successfully' })
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					console.error('Save error:', errorMessage, error)
					res.status(500).json({ 
						error: 'Failed to save mermaid file: ' + errorMessage,
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
					"Mermaid diagram editor",
					["Real-time editing", "syntax validation", "screenshot export", "file change monitoring"]
				),
			}
		} catch (error) {
			return this.handleError("show Mermaid file", error)
		}
	}
}