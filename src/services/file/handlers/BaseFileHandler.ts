import path from "path"
import { FileReadRequest, FileReadResult } from "../FileService"

export abstract class BaseFileHandler {
	// 抽象方法 - 子类必须实现
	abstract canHandle(filePath: string): boolean
	abstract readFile(request: FileReadRequest): Promise<FileReadResult>
	
	// 公共工具方法
	protected getFileExtension(filePath: string): string {
		return path.extname(filePath).toLowerCase()
	}
	
	protected handleReadError(error: Error, filePath: string): never {
		throw new Error(`Failed to read ${filePath}: ${error.message}`)
	}
	
	protected createResult(
		content: string, 
		totalLines: number, 
		isFileTruncated = false,
		sourceCodeDef?: string
	): FileReadResult {
		return {
			content,
			totalLines,
			isFileTruncated,
			sourceCodeDef,
			fileType: this.getFileType()
		}
	}
	
	protected abstract getFileType(): string
}