// npx jest DocxHandler.test.ts

import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import { DocxHandler } from "../DocxHandler"

// Mock mammoth library
jest.mock("mammoth", () => ({
	extractRawText: jest.fn(),
}))

import mammoth from "mammoth"

describe("DocxHandler", () => {
	let handler: DocxHandler
	const mockMammoth = mammoth as jest.Mocked<typeof mammoth>

	beforeEach(() => {
		handler = new DocxHandler()
		jest.clearAllMocks()
	})

	describe("canHandle 方法测试", () => {
		it("应该能处理 .docx 文件", () => {
			// 测试各种 .docx 文件路径
			expect(handler.canHandle("document.docx")).toBe(true)
			expect(handler.canHandle("report.DOCX")).toBe(true)
			expect(handler.canHandle("/path/to/file.docx")).toBe(true)
			expect(handler.canHandle("../folder/test.docx")).toBe(true)
		})

		it("不应该处理非 .docx 文件", () => {
			// 测试其他文件类型
			expect(handler.canHandle("document.pdf")).toBe(false)
			expect(handler.canHandle("report.txt")).toBe(false)
			expect(handler.canHandle("image.jpg")).toBe(false)
			expect(handler.canHandle("script.js")).toBe(false)
			expect(handler.canHandle("file.doc")).toBe(false) // 注意：.doc 不是 .docx
		})

		it("应该处理没有扩展名的文件", () => {
			expect(handler.canHandle("document")).toBe(false)
			expect(handler.canHandle("")).toBe(false)
		})
	})

	describe("readFile 方法测试", () => {
		it("应该成功读取docx文件内容", async () => {
			// Mock mammoth 返回的结果
			const mockText = "这是第一行\n这是第二行\n这是第三行"
			mockMammoth.extractRawText.mockResolvedValue({
				value: mockText,
				messages: []
			})

			const request = {
				filePath: "test.docx",
				cwd: "/test/path",
				maxLines: 100
			}

			const result = await handler.readFile(request)

			// 验证结果
			expect(result.content).toContain("1 | 这是第一行")
			expect(result.content).toContain("2 | 这是第二行") 
			expect(result.content).toContain("3 | 这是第三行")
			expect(result.totalLines).toBe(3)
			expect(result.isFileTruncated).toBe(false)
			expect(result.fileType).toBe("docx")
		})

		it("应该处理文件读取错误", async () => {
			// Mock mammoth 抛出错误
			mockMammoth.extractRawText.mockRejectedValue(new Error("文件损坏"))

			const request = {
				filePath: "broken.docx",
				cwd: "/test/path"
			}

			// 验证错误处理
			await expect(handler.readFile(request)).rejects.toThrow("Failed to parse DOCX file")
		})
	})
}) 