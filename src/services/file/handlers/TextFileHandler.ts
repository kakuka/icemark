import path from "path"
import { isBinaryFile } from "isbinaryfile"
import { BaseFileHandler } from "./BaseFileHandler"
import { FileReadRequest, FileReadResult } from "../FileService"
import { countFileLines } from "../../../integrations/misc/line-counter"
import { readLines } from "../../../integrations/misc/read-lines"
import { extractTextFromFile, addLineNumbers } from "../../../integrations/misc/extract-text"
import { parseSourceCodeDefinitionsForFile } from "../../tree-sitter"
import { RooIgnoreController } from "../../../core/ignore/RooIgnoreController"

export class TextFileHandler extends BaseFileHandler {
	constructor(private rooIgnoreController?: RooIgnoreController) {
		super()
	}
	
	canHandle(_filePath: string): boolean {
		// 默认处理器，总是尝试读取
		return true
	}
	
	protected getFileType(): string {
		return 'text'
	}
	
	async readFile(request: FileReadRequest): Promise<FileReadResult> {
		const { filePath, startLine, endLine, maxLines, fullRead: _fullRead } = request
		const absolutePath = path.resolve(request.cwd, filePath)
		
		// Count total lines in the file
		let totalLines = 0
		try {
			totalLines = await countFileLines(absolutePath)
		} catch (error) {
			console.error(`Error counting lines in file ${absolutePath}:`, error)
		}

		// now execute the tool like normal
		let content: string
		let isFileTruncated = false
		let sourceCodeDef = ""

		const isBinary = await isBinaryFile(absolutePath).catch(() => false)

		// Check if we're doing a line range read
		const isRangeRead = startLine !== undefined || endLine !== undefined

		if (isRangeRead) {
			if (startLine === undefined) {
				content = addLineNumbers(await readLines(absolutePath, endLine, startLine))
			} else {
				content = addLineNumbers(await readLines(absolutePath, endLine, startLine), startLine + 1)
			}
		} else if (!isBinary && maxLines !== undefined && maxLines >= 0 && totalLines > maxLines) {
			// If file is too large, only read the first maxLines lines
			isFileTruncated = true

			const res = await Promise.all([
				maxLines > 0 ? readLines(absolutePath, maxLines - 1, 0) : "",
				parseSourceCodeDefinitionsForFile(absolutePath, this.rooIgnoreController),
			])

			content = res[0].length > 0 ? addLineNumbers(res[0]) : ""
			const result = res[1]

			if (result) {
				sourceCodeDef = `${result}`
			}
		} else {
			// Read entire file
			content = await extractTextFromFile(absolutePath)
		}

		return {
			content,
			totalLines,
			isFileTruncated,
			sourceCodeDef: sourceCodeDef || undefined,
			fileType: this.getFileType()
		}
	}
}