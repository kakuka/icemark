import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { PrototypeResult, IcemarkFileNode } from "./types"
import { MermaidEngine } from "./engines/MermaidEngine"
import { ExcalidrawEngine } from "./engines/ExcalidrawEngine"
import { HtmlEngine } from "./engines/HtmlEngine"
import { MarkdownEngine } from "./engines/MarkdownEngine"

// 重新导出类型以保持对外接口的兼容性
export type { PrototypeResult, IcemarkFileNode } from "./types"

export class PrototypeService {
	private context: vscode.ExtensionContext
	private workspacePath: string
	private mermaidEngine: MermaidEngine
	private excalidrawEngine: ExcalidrawEngine
	private htmlEngine: HtmlEngine
	private markdownEngine: MarkdownEngine

	constructor(context: vscode.ExtensionContext, workspacePath: string) {
		this.context = context
		this.workspacePath = workspacePath
		
		// 预先创建所有引擎实例
		this.mermaidEngine = new MermaidEngine(context, workspacePath)
		this.excalidrawEngine = new ExcalidrawEngine(context, workspacePath)
		this.htmlEngine = new HtmlEngine(context, workspacePath)
		this.markdownEngine = new MarkdownEngine(context, workspacePath)
	}

	async init(path: string, args: any = {}): Promise<PrototypeResult> {
		const engine = this.getEngine(path)
		return engine.init(path, args)
	}

	async show(path: string, args: any = {}): Promise<PrototypeResult> {
		const engine = this.getEngine(path)
		return engine.show(path, args)
	}

	async scan(): Promise<IcemarkFileNode[]> {
		const fileTree: IcemarkFileNode[] = []
		
		try {
			await this.buildFileTree(this.workspacePath, fileTree)
		} catch (error) {
			console.error('Error scanning workspace:', error)
		}
		
		return fileTree
	}

	// 判断文件是否可渲染
	private isRenderable(path: string): boolean {
		return path.endsWith('.mmd') || 
			   path.endsWith('.excalidraw') || 
			   path.endsWith('.excalidraw.json') ||
			   path.endsWith('-html-web') ||
			   path.endsWith('-html-mobile') ||
			   path.endsWith('.md')
	}

	// 递归构建文件树
	private async buildFileTree(currentPath: string, parentArray: IcemarkFileNode[]): Promise<void> {
		const entries = await fs.readdir(currentPath, { withFileTypes: true })
		
		for (const entry of entries) {
			// 跳过隐藏文件和常见忽略目录
			if (entry.name.startsWith('.') || 
				['node_modules', 'dist', 'build', '.git', '.vscode'].includes(entry.name)) {
				continue
			}
			
			const fullPath = path.join(currentPath, entry.name)
			const relativePath = path.relative(this.workspacePath, fullPath)
			const stats = await fs.stat(fullPath)
			
			const node: IcemarkFileNode = {
				path: relativePath.replace(/\\/g, '/'), // 统一使用正斜杠
				type: entry.isDirectory() ? 'folder' : 'file',
				mtime: stats.mtime.getTime(),
				ctime: stats.ctime.getTime(),
				renderable: this.isRenderable(relativePath)
			}
			
			if (entry.isDirectory()) {
				node.children = []
				await this.buildFileTree(fullPath, node.children)
			}
			
			parentArray.push(node)
		}
	}

	private getEngine(path: string) {
		if (path.endsWith('.mmd')) {
			return this.mermaidEngine
		}
		if (path.endsWith('.excalidraw') || path.endsWith('.excalidraw.json')) {
			return this.excalidrawEngine
		}
		if (path.endsWith('-html-web') || path.endsWith('-html-mobile')) {
			return this.htmlEngine
		}
		if (path.endsWith('.md')) {
			return this.markdownEngine
		}
		throw new Error(`Invalid path format: ${path}. Must end with .mmd, .excalidraw, .excalidraw.json, -html-web, -html-mobile, or .md`)
	}
}
