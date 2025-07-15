import { BaseFileHandler } from "./handlers/BaseFileHandler"
import { TextFileHandler } from "./handlers/TextFileHandler"
import { PDFHandler } from "./handlers/PDFHandler"
import { DocxHandler } from "./handlers/DocxHandler"
import { OfficeFileHandler } from "./handlers/OfficeFileHandler"
import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"

export interface FileReadRequest {
	filePath: string
	startLine?: number
	endLine?: number
	maxLines?: number
	fullRead?: boolean
	cwd: string
}

export interface FileReadResult {
	content: string
	totalLines: number
	isFileTruncated: boolean
	sourceCodeDef?: string
	fileType: string
}

/**
 * FileService 管理不同类型文件的读取处理器
 * 
 * 架构设计说明：
 * 1. 使用专门的Handler处理特定文件类型，以获得最佳性能和功能
 * 2. TextFileHandler作为默认兜底处理器，但有重要限制（见下文）
 * 
 * 关于TextFileHandler的重要问题：
 * TextFileHandler虽然可以通过extractTextFromFile处理PDF和DOCX，
 * 但在行范围读取(startLine/endLine)和大文件截断(maxLines)时存在严重问题：
 * - readLines函数直接读取文件的原始二进制内容
 * - 对PDF/DOCX文件，这会读取到乱码的二进制数据，而非解析后的文本
 * - 只有完整文件读取时才会调用extractTextFromFile进行正确解析
 * 
 * 因此我们使用专门的Handler来解决这些问题：
 * - PDFHandler: 专门处理PDF文件，支持完整的行操作和元数据提取
 * - DocxHandler: 专门处理DOCX文件，支持完整的行操作和文档分析
 * - OfficeFileHandler: 处理其他Office格式(.pptx, .xlsx, .doc等)
 * - TextFileHandler: 处理纯文本和其他格式，作为默认兜底
 */
export class FileService {
	private handlers: BaseFileHandler[]
	private defaultHandler: TextFileHandler
	
	constructor(rooIgnoreController?: RooIgnoreController) {
		this.handlers = [
			// 专门的文档处理器，解决TextFileHandler的行读取问题
			new PDFHandler(rooIgnoreController),           // 处理PDF文件，使用pdf-parse
			new DocxHandler(rooIgnoreController),          // 处理DOCX文件，使用mammoth
			new OfficeFileHandler(rooIgnoreController),    // 处理其他Office格式，使用officeparser
		]
		this.defaultHandler = new TextFileHandler(rooIgnoreController)
	}
	
	async readFile(request: FileReadRequest): Promise<FileReadResult> {
		const handler = this.findHandler(request.filePath)
		return await handler.readFile(request)
	}
	
	private findHandler(filePath: string): BaseFileHandler {
		// 先查找专用处理器
		const specificHandler = this.handlers.find(handler => handler.canHandle(filePath))
		
		// 如果找到专用处理器就用专用的，否则用默认的TextFileHandler兜底
		return specificHandler || this.defaultHandler
	}
}