import path from "path"
import { BaseFileHandler } from "./BaseFileHandler"
import { FileReadRequest, FileReadResult } from "../FileService"
import { addLineNumbers } from "../../../integrations/misc/extract-text"
import { RooIgnoreController } from "../../../core/ignore/RooIgnoreController"
import fs from "fs/promises"

// @ts-ignore-next-line
import pdf from "pdf-parse/lib/pdf-parse"

export class PDFHandler extends BaseFileHandler {
	constructor(private rooIgnoreController?: RooIgnoreController) {
		super()
	}
	
	canHandle(filePath: string): boolean {
		const ext = path.extname(filePath).toLowerCase()
		return ext === '.pdf'
	}
	
	protected getFileType(): string {
		return 'pdf'
	}
	
	async readFile(request: FileReadRequest): Promise<FileReadResult> {
		console.log("PDFHandler readFile", request)
		const { filePath, startLine, endLine, maxLines } = request
		const absolutePath = path.resolve(request.cwd, filePath)
		
		try {
			// 先解析PDF文件内容
			const dataBuffer = await fs.readFile(absolutePath)
			const pdfData = await pdf(dataBuffer)
			const extractedText = pdfData.text || ''
			
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
				content = addLineNumbers(selectedLines.join('\n'), start + 1)
			} else if (maxLines !== undefined && maxLines >= 0 && totalLines > maxLines) {
				// 如果文件太大，只返回前 maxLines 行，并提供文档结构信息
				isFileTruncated = true
				const truncatedLines = lines.slice(0, maxLines)
				content = addLineNumbers(truncatedLines.join('\n'))
			} else {
				// 为完整内容添加行号
				content = addLineNumbers(extractedText)
			}

			// 生成PDF文档结构概览（当文件被截断时）
			const sourceCodeDef = isFileTruncated ? this.generatePDFStructure(pdfData, extractedText, absolutePath) : undefined

			return {
				content,
				totalLines,
				isFileTruncated,
				sourceCodeDef,
				fileType: this.getFileType()
			}

		} catch (error) {
			throw new Error(`Failed to parse PDF file ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * 生成PDF文档结构概览
	 */
	private generatePDFStructure(pdfData: any, content: string, filePath: string): string {
		const fileName = path.basename(filePath)
		const structure: string[] = []
		
		structure.push(`PDF Document: ${fileName}`)
		
		// PDF元数据
		if (pdfData.info) {
			const info = pdfData.info
			if (info.Title) structure.push(`Title: ${info.Title}`)
			if (info.Author) structure.push(`Author: ${info.Author}`)
			if (info.Subject) structure.push(`Subject: ${info.Subject}`)
			if (info.Creator) structure.push(`Creator: ${info.Creator}`)
			if (info.Producer) structure.push(`Producer: ${info.Producer}`)
			if (info.CreationDate) structure.push(`Created: ${info.CreationDate}`)
			if (info.ModDate) structure.push(`Modified: ${info.ModDate}`)
		}
		
		// 页面信息
		if (pdfData.numpages) {
			structure.push(`Total Pages: ${pdfData.numpages}`)
		}
		
		// 文本统计
		const lines = content.split('\n')
		const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
		structure.push(`\nText Statistics:`)
		structure.push(`  Total Lines: ${lines.length}`)
		structure.push(`  Word Count: ${wordCount}`)
		structure.push(`  Character Count: ${content.length}`)

		// 分析可能的章节标题
		const headings = this.extractPDFHeadings(lines)
		if (headings.length > 0) {
			structure.push('\nDocument Structure:')
			headings.forEach((heading, index) => {
				structure.push(`  ${index + 1}. ${heading}`)
			})
		}

		return structure.join('\n')
	}

	/**
	 * 从PDF文本中提取可能的标题
	 */
	private extractPDFHeadings(lines: string[]): string[] {
		const headings: string[] = []
		
		for (let i = 0; i < Math.min(lines.length, 100); i++) { // 检查前100行
			const line = lines[i].trim()
			
			if (line.length > 0 && line.length < 120) {
				// PDF标题检测逻辑
				if (
					line.match(/^[A-Z\s]+$/) ||  // 全大写
					line.match(/^\d+[\.\)]\s/) ||  // 数字编号
					line.match(/^Chapter\s+\d+/i) ||  // 章节
					line.match(/^第.+章/) ||       // 中文章节
					line.match(/^[IVX]+[\.\)]\s/) ||  // 罗马数字
					(line.length < 60 && lines[i + 1]?.trim() === '') // 短行且下一行为空
				) {
					headings.push(line)
				}
			}
		}
		
		return headings.slice(0, 15) // 最多返回15个标题
	}
} 