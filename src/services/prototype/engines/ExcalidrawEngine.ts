import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { BaseEngine } from "./BaseEngine"
import { PrototypeResult } from "../types"

export class ExcalidrawEngine extends BaseEngine {
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
					message: `Excalidraw file already exists: ${pathParam}`,
				}
			} catch (error) {
				// 文件不存在，继续创建
			}
			
			// 创建初始Excalidraw文件
			const excalidrawData = {
				type: "excalidraw",
				version: 2,
				source: "https://excalidraw.com",
				elements: [],
				appState: { viewBackgroundColor: "#ffffff" },
				files: {}
			}
			
			await fs.writeFile(fullPath, JSON.stringify(excalidrawData, null, 2))
			
			const message = `Successfully created Excalidraw file: ${pathParam}\n` +
				`File path: ${fullPath}\n` +
				`File name: ${path.basename(fullPath)}\n` +
				`Type: Excalidraw diagram\n` +
				`Initial state: Empty canvas with white background`
			
			return {
				success: true,
				message: message,
			}
		} catch (error) {
			return this.handleError("create Excalidraw file", error)
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
					message: `Excalidraw file not found: ${pathParam}`,
				}
			}

			// 生成唯一的文件ID
			const fileId = this.generateFileId(fullPath)

			// 创建Express应用
			const app = this.createExpressApp()
			
			// 设置路由
			const excalidrawAssetsPath = this.context.asAbsolutePath(path.join("assets", "excalidraw"))
			app.use('/assets', require('express').static(path.join(excalidrawAssetsPath, 'assets')))
			
			app.get('/', (_req: any, res: any) => {
				res.sendFile(path.join(excalidrawAssetsPath, 'index.html'))
			})
			
			// 设置文件信息路由
			this.setupFileInfoRoute(app)
			
			// 使用文件ID获取文件内容
			app.get('/file/:fileId', async (req: any, res: any) => {
				try {
					const fileId = req.params.fileId
					const filePath = this.getFilePathById(fileId)
					
					if (!filePath) {
						console.error('File ID not found:', fileId)
						return res.status(404).json({ error: 'File not found' })
					}
					
					console.log('Loading file:', filePath)
					const data = await fs.readFile(filePath, 'utf8')
					const jsonData = JSON.parse(data)
					
					// 添加Last-Modified头
					const modificationTime = await this.getFileModificationTime(filePath)
					res.set('Last-Modified', new Date(modificationTime).toUTCString())
					
					res.json(jsonData)
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					console.error('Load error:', errorMessage, error)
					res.status(500).json({ 
						error: 'Failed to load file: ' + errorMessage,
						details: error instanceof Error ? error.stack : undefined
					})
				}
			})
			
			// 使用文件ID保存文件
			app.post('/save/:fileId', async (req: any, res: any) => {
				try {
					const fileId = req.params.fileId
					const filePath = this.getFilePathById(fileId)
					
					if (!filePath) {
						console.error('File ID not found:', fileId)
						return res.status(404).json({ error: 'File not found' })
					}
					
					const data = req.body
					if (!data || typeof data !== 'object') {
						console.error('Invalid data received:', typeof data)
						return res.status(400).json({ error: 'Invalid data format' })
					}
					
					console.log('Saving file:', filePath)
					
					// 确保目录存在
					const dir = path.dirname(filePath)
					await fs.mkdir(dir, { recursive: true })
					
					await fs.writeFile(filePath, JSON.stringify(data, null, 2))
					console.log('File saved successfully:', filePath)
					res.json({ success: true, message: 'File saved successfully' })
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					console.error('Save error:', errorMessage, error)
					res.status(500).json({ 
						error: 'Failed to save file: ' + errorMessage,
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
					"Excalidraw diagram editor",
					["Real-time editing", "auto-save enabled", "file change monitoring"]
				),
			}
		} catch (error) {
			return this.handleError("show Excalidraw file", error)
		}
	}
} 