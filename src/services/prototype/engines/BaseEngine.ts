import * as vscode from "vscode"
import * as fs from "fs/promises"
import { PrototypeResult } from "../types"

// 全局文件路径映射存储，避免URL编解码问题
const globalFilePathMap = new Map<string, string>()

export abstract class BaseEngine {
	protected context: vscode.ExtensionContext
	protected workspacePath: string

	constructor(context: vscode.ExtensionContext, workspacePath: string) {
		this.context = context
		this.workspacePath = workspacePath
	}

	abstract init(path: string, args: any): Promise<PrototypeResult>
	abstract show(path: string, args: any): Promise<PrototypeResult>

	/**
	 * 寻找可用端口
	 */
	protected async findAvailablePort(): Promise<number> {
		const net = require('net')
		return new Promise((resolve, reject) => {
			const server = net.createServer()
			server.listen(0, () => {
				const port = (server.address() as any).port
				server.once('close', () => resolve(port))
				server.close()
			})
			server.on('error', reject)
		})
	}

	/**
	 * 创建Express应用并设置通用路由
	 */
	protected createExpressApp(): any {
		const express = require('express')
		const app = express()
		
		// 解析JSON请求体
		app.use(express.json({ limit: '100mb' }))
		
		// 设置通用路由
		this.setupCommonRoutes(app)
		
		return app
	}

	/**
	 * 设置通用路由
	 */
	private setupCommonRoutes(app: any): void {
		// 添加 favicon 路由避免 404
		app.get('/favicon.ico', (_req: any, res: any) => {
			res.status(204).send()
		})

		// 健康检查路由
		app.get('/health', (_req: any, res: any) => {
			res.json({ status: 'OK', timestamp: new Date().toISOString() })
		})

		// 通用错误处理
		app.use((err: any, _req: any, res: any, _next: any) => {
			console.error('Server error:', err)
			res.status(500).json({ 
				error: 'Internal server error', 
				message: err.message 
			})
		})
	}

	/**
	 * 生成文件ID并存储文件路径映射
	 */
	protected generateFileId(filePath: string): string {
		const fileId = Date.now().toString(36) + Math.random().toString(36).substr(2)
		globalFilePathMap.set(fileId, filePath)
		return fileId
	}

	/**
	 * 根据文件ID获取文件路径
	 */
	protected getFilePathById(fileId: string): string | undefined {
		return globalFilePathMap.get(fileId)
	}

	/**
	 * 清理文件ID映射
	 */
	protected clearFileId(fileId: string): void {
		globalFilePathMap.delete(fileId)
	}

	/**
	 * 获取文件修改时间
	 */
	protected async getFileModificationTime(filePath: string): Promise<number> {
		try {
			const stats = await fs.stat(filePath)
			return stats.mtime.getTime()
		} catch (error) {
			console.error('Failed to get file modification time:', error)
			return 0
		}
	}

	/**
	 * 设置文件信息查询路由
	 */
	protected setupFileInfoRoute(app: any): void {
		app.get('/file-info/:fileId', async (req: any, res: any) => {
			try {
				const fileId = req.params.fileId
				const filePath = this.getFilePathById(fileId)
				
				if (!filePath) {
					return res.status(404).json({ error: 'File not found' })
				}
				
				const modificationTime = await this.getFileModificationTime(filePath)
				
				// 计算相对于工作区的路径
				const path = require('path')
				const relativePath = path.relative(this.workspacePath, filePath)
				
				res.json({ 
					fileId, 
					filePath: relativePath,
					modificationTime,
					exists: modificationTime > 0
				})
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				res.status(500).json({ error: 'Failed to get file info: ' + errorMessage })
			}
		})
	}

	/**
	 * 启动HTTP服务器
	 */
	protected async startHttpServer(app: any): Promise<{ port: number; server: any }> {
		const port = await this.findAvailablePort()
		const server = app.listen(port)
		return { port, server }
	}

	/**
	 * 生成统一的成功消息格式
	 */
	protected generateSuccessMessage(pathParam: string, fullPath: string, viewerUrl: string, port: number, type: string, features: string[]): string {
		const path = require('path')
		return `Successfully opened ${type} viewer: ${pathParam}\n` +
			`File path: ${fullPath}\n` +
			`File name: ${path.basename(fullPath)}\n` +
			`Viewer URL: ${viewerUrl}\n` +
			`Server port: ${port}\n` +
			`Type: ${type}\n` +
			`Features: ${features.join(', ')}`
	}

	/**
	 * 统一的错误处理
	 */
	protected handleError(operation: string, error: any): PrototypeResult {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(`${operation} failed:`, error)
		return {
			success: false,
			message: `Failed to ${operation}: ${errorMessage}`,
		}
	}
} 