import path from "path"
import { BaseFileHandler } from "./BaseFileHandler"
import { FileReadRequest, FileReadResult } from "../FileService"
import { RooIgnoreController } from "../../../core/ignore/RooIgnoreController"

// 动态导入 officeparser（如果没有安装会fallback到error）
let officeParser: any = null
try {
	officeParser = require('officeparser')
} catch (error) {
	console.warn('officeparser not installed, OfficeFileHandler will not work properly')
}

export class OfficeFileHandler extends BaseFileHandler {
	// 处理除PDF和DOCX之外的Office文件格式
	// PDF和DOCX有专门的Handler处理，以获得更好的性能和专门的功能
	private static readonly SUPPORTED_EXTENSIONS = new Set([
		'.doc', '.pptx', '.ppt', '.xlsx', '.xls', 
		'.odt', '.odp', '.ods'
	])

	constructor(private rooIgnoreController?: RooIgnoreController) {
		super()
	}
	
	canHandle(filePath: string): boolean {
		const ext = path.extname(filePath).toLowerCase()
		return OfficeFileHandler.SUPPORTED_EXTENSIONS.has(ext)
	}
	
	protected getFileType(): string {
		return 'office'
	}
	
	async readFile(request: FileReadRequest): Promise<FileReadResult> {
		console.log("OfficeFileHandler readFile", request)
		const { filePath, startLine, endLine, maxLines } = request
		const absolutePath = path.resolve(request.cwd, filePath)
		
		if (!officeParser) {
			throw new Error('officeparser library is not installed. Please run: npm install officeparser')
		}

		try {
			// 使用 officeparser 提取文本内容
			const extractedText = await new Promise<string>((resolve, reject) => {
				const config = {
					outputErrorToConsole: false,
					newlineDelimiter: '\n',
					ignoreNotes: false,
					putNotesAtLast: false
				}
				
				officeParser.parseOffice(absolutePath, (data: string, err: any) => {
					if (err) {
						reject(err)
					} else {
						resolve(data || '')
					}
				}, config)
			})

			// 将提取的文本按行分割处理
			const lines = extractedText.split('\n')
			let content = extractedText
			let totalLines = lines.length
			let isFileTruncated = false

			// 处理行范围读取
			const isRangeRead = startLine !== undefined || endLine !== undefined
			if (isRangeRead) {
				const start = startLine ?? 0
				const end = endLine ?? lines.length - 1
				const selectedLines = lines.slice(start, end + 1)
				content = selectedLines.map((line, index) => `${start + index + 1}: ${line}`).join('\n')
			} else if (maxLines !== undefined && maxLines >= 0 && totalLines > maxLines) {
				// 如果文件太大，只返回前 maxLines 行，并提供文档结构信息
				isFileTruncated = true
				const truncatedLines = lines.slice(0, maxLines)
				content = truncatedLines.map((line, index) => `${index + 1}: ${line}`).join('\n')
			} else {
				// 为完整内容添加行号
				content = lines.map((line, index) => `${index + 1}: ${line}`).join('\n')
			}

			// 生成文档结构概览（替代源代码定义）
			const sourceCodeDef = isFileTruncated ? this.generateDocumentStructure(extractedText, absolutePath) : undefined

			return {
				content,
				totalLines,
				isFileTruncated,
				sourceCodeDef,
				fileType: this.getFileType()
			}

		} catch (error) {
			throw new Error(`Failed to parse office file ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * 生成文档结构概览，替代 parseSourceCodeDefinitionsForFile 的功能
	 */
	private generateDocumentStructure(content: string, filePath: string): string {
		const fileExt = path.extname(filePath).toLowerCase()
		const fileName = path.basename(filePath)
		
		// 简单的文档结构分析
		const lines = content.split('\n')
		const structure: string[] = []
		
		structure.push(`Document: ${fileName}`)
		structure.push(`Type: ${this.getDocumentType(fileExt)}`)
		structure.push(`Total Lines: ${lines.length}`)
		structure.push(`Total Characters: ${content.length}`)
		
		// 分析可能的标题和重要段落
		const headings = this.extractHeadings(lines)
		if (headings.length > 0) {
			structure.push('\nDocument Structure:')
			headings.forEach((heading, index) => {
				structure.push(`  ${index + 1}. ${heading}`)
			})
		}

		// 统计信息
		const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
		structure.push(`\nStatistics:`)
		structure.push(`  Word Count: ${wordCount}`)
		structure.push(`  Character Count: ${content.length}`)
		structure.push(`  Line Count: ${lines.length}`)

		return structure.join('\n')
	}

	/**
	 * 根据文件扩展名返回文档类型
	 */
	private getDocumentType(ext: string): string {
		switch (ext) {
			case '.docx':
			case '.doc':
				return 'Word Document'
			case '.xlsx':
			case '.xls':
				return 'Excel Spreadsheet'
			case '.pptx':
			case '.ppt':
				return 'PowerPoint Presentation'
			case '.pdf':
				return 'PDF Document'
			case '.odt':
				return 'OpenDocument Text'
			case '.ods':
				return 'OpenDocument Spreadsheet'
			case '.odp':
				return 'OpenDocument Presentation'
			default:
				return 'Office Document'
		}
	}

	/**
	 * 从文本中提取可能的标题
	 */
	private extractHeadings(lines: string[]): string[] {
		const headings: string[] = []
		
		for (let i = 0; i < Math.min(lines.length, 50); i++) { // 只检查前50行
			const line = lines[i].trim()
			
			// 简单的标题检测逻辑
			if (line.length > 0 && line.length < 100) {
				// 检查是否可能是标题（全大写、或包含数字编号、或较短且独立）
				if (
					line.match(/^[A-Z\s]+$/) ||  // 全大写
					line.match(/^\d+[\.\)]\s/) ||  // 数字编号
					line.match(/^第.+章/) ||       // 中文章节
					line.match(/^Chapter\s+\d+/i) ||  // 英文章节
					(line.length < 50 && lines[i + 1]?.trim() === '') // 短行且下一行为空
				) {
					headings.push(line)
				}
			}
		}
		
		return headings.slice(0, 10) // 最多返回10个标题
	}
} 