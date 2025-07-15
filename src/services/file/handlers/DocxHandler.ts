import path from "path"
import { BaseFileHandler } from "./BaseFileHandler"
import { FileReadRequest, FileReadResult } from "../FileService"
import { addLineNumbers } from "../../../integrations/misc/extract-text"
import { RooIgnoreController } from "../../../core/ignore/RooIgnoreController"
import mammoth from "mammoth"

export class DocxHandler extends BaseFileHandler {
	constructor(private rooIgnoreController?: RooIgnoreController) {
		super()
	}
	
	canHandle(filePath: string): boolean {
		const ext = path.extname(filePath).toLowerCase()
		return ext === '.docx'
	}
	
	protected getFileType(): string {
		return 'docx'
	}
	
	async readFile(request: FileReadRequest): Promise<FileReadResult> {
        console.log("DocxHandler readFile", request)
		const { filePath, startLine, endLine, maxLines } = request
		const absolutePath = path.resolve(request.cwd, filePath)
		
		try {
			// 先解析DOCX文件内容
			const result = await mammoth.extractRawText({ path: absolutePath })
			const extractedText = result.value || ''
			
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

			// 生成DOCX文档结构概览（当文件被截断时）
			const sourceCodeDef = isFileTruncated ? this.generateDocxStructure(result, extractedText, absolutePath) : undefined

			return {
				content,
				totalLines,
				isFileTruncated,
				sourceCodeDef,
				fileType: this.getFileType()
			}

		} catch (error) {
			throw new Error(`Failed to parse DOCX file ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * 生成DOCX文档结构概览
	 */
	private generateDocxStructure(result: any, content: string, filePath: string): string {
		const fileName = path.basename(filePath)
		const structure: string[] = []
		
		structure.push(`Word Document: ${fileName}`)
		structure.push(`Type: Microsoft Word Document (.docx)`)
		
		// 处理mammoth的警告信息
		if (result.messages && result.messages.length > 0) {
			const warnings = result.messages.filter((msg: any) => msg.type === 'warning')
			if (warnings.length > 0) {
				structure.push(`\nDocument Processing Notes:`)
				structure.push(`  ${warnings.length} formatting elements were not fully converted`)
			}
		}
		
		// 文本统计
		const lines = content.split('\n')
		const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0)
		const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
		
		structure.push(`\nDocument Statistics:`)
		structure.push(`  Total Lines: ${lines.length}`)
		structure.push(`  Paragraphs: ${paragraphs.length}`)
		structure.push(`  Word Count: ${wordCount}`)
		structure.push(`  Character Count: ${content.length}`)

		// 分析可能的标题和结构
		const headings = this.extractDocxHeadings(lines)
		if (headings.length > 0) {
			structure.push('\nDocument Structure:')
			headings.forEach((heading, index) => {
				structure.push(`  ${index + 1}. ${heading}`)
			})
		}

		// 分析段落长度分布
		const shortParagraphs = paragraphs.filter(p => p.length < 100).length
		const mediumParagraphs = paragraphs.filter(p => p.length >= 100 && p.length < 500).length
		const longParagraphs = paragraphs.filter(p => p.length >= 500).length
		
		if (paragraphs.length > 0) {
			structure.push(`\nParagraph Analysis:`)
			structure.push(`  Short paragraphs (<100 chars): ${shortParagraphs}`)
			structure.push(`  Medium paragraphs (100-500 chars): ${mediumParagraphs}`)
			structure.push(`  Long paragraphs (>500 chars): ${longParagraphs}`)
		}

		return structure.join('\n')
	}

	/**
	 * 从DOCX文本中提取可能的标题
	 */
	private extractDocxHeadings(lines: string[]): string[] {
		const headings: string[] = []
		
		for (let i = 0; i < Math.min(lines.length, 80); i++) { // 检查前80行
			const line = lines[i].trim()
			
			if (line.length > 0 && line.length < 150) {
				// Word文档标题检测逻辑
				if (
					line.match(/^[A-Z\s]+$/) ||  // 全大写
					line.match(/^\d+[\.\)]\s/) ||  // 数字编号
					line.match(/^Chapter\s+\d+/i) ||  // 英文章节
					line.match(/^第.+章/) ||       // 中文章节
					line.match(/^[IVX]+[\.\)]\s/) ||  // 罗马数字
					line.match(/^(Abstract|Introduction|Conclusion|References|Bibliography)$/i) ||  // 学术论文常见章节
					line.match(/^(摘要|引言|绪论|结论|参考文献)$/) ||  // 中文学术章节
					(line.length < 80 && lines[i + 1]?.trim() === '' && !line.includes('.')) // 短行且下一行为空，且不包含句号
				) {
					headings.push(line)
				}
			}
		}
		
		return headings.slice(0, 12) // 最多返回12个标题
	}
} 