import { Cline } from "../Cline"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import * as fs from "fs"
import * as path from "path"
import { getWorkspacePath, getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"

export async function urlContentFetchTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const url: string | undefined = block.params.url
	const saveToFileFullPath: string | undefined = block.params.save_to_file_full_path

	const sharedMessageProps: ClineSayTool = {
		tool: "urlContentFetch",
		url: removeClosingTag("url", url),
		saveToFileFullPath: removeClosingTag("save_to_file_full_path", saveToFileFullPath),
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: undefined } satisfies ClineSayTool)

			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			// Validate required parameters
			if (!url) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("url_content_fetch")
				pushToolResult(await cline.sayAndCreateMissingParamError("url_content_fetch", "url"))
				return
			}

			// Validate URL format
			let validatedUrl: URL
			try {
				validatedUrl = new URL(url)
				if (!["http:", "https:"].includes(validatedUrl.protocol)) {
					throw new Error("Only HTTP and HTTPS URLs are supported")
				}
			} catch (error) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("url_content_fetch")
				await cline.say("error", `Icemark tried to fetch content from invalid URL '${url}'. ${error}. Retrying...`)
				pushToolResult(formatResponse.toolError(`Invalid URL format: ${url}. Only HTTP and HTTPS URLs are supported.`))
				return
			}

			// Validate save path if provided
			let resolvedSavePath: string | undefined
			let isOutsideWorkspace = false
			if (saveToFileFullPath) {
				try {
					// Convert to absolute path
					if (path.isAbsolute(saveToFileFullPath)) {
						resolvedSavePath = saveToFileFullPath
					} else {
						const workspacePath = getWorkspacePath()
						if (!workspacePath) {
							throw new Error("No workspace is open, cannot resolve relative path")
						}
						resolvedSavePath = path.resolve(workspacePath, saveToFileFullPath)
					}

					// Check if outside workspace
					isOutsideWorkspace = isPathOutsideWorkspace(resolvedSavePath)

					// Validate filename (no directory separators in filename part)
					const filename = path.basename(resolvedSavePath)
					if (!filename || filename === "." || filename === "..") {
						throw new Error("Invalid filename")
					}
				} catch (error) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("url_content_fetch")
					await cline.say("error", `Icemark tried to use invalid save path '${saveToFileFullPath}'. ${error}. Retrying...`)
					pushToolResult(formatResponse.toolError(`Invalid save path: ${saveToFileFullPath}. ${error}`))
					return
				}
			}

			cline.consecutiveMistakeCount = 0

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: url,
				path: resolvedSavePath ? getReadablePath(cline.cwd, resolvedSavePath) : undefined,
				isOutsideWorkspace,
			} satisfies ClineSayTool)

			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			await cline.say("text", `正在从 ${url} 获取网页内容...`)

			try {
				// Launch browser
				await cline.say("text", "启动浏览器...")
				await cline.urlContentFetcher.launchBrowser()

				// Fetch content
				await cline.say("text", "正在解析网页内容...")
				const markdownContent = await cline.urlContentFetcher.urlToMarkdown(url)

				// Close browser
				await cline.urlContentFetcher.closeBrowser()

				if (!markdownContent || markdownContent.trim().length === 0) {
					await cline.say("text", "警告：获取到的内容为空")
					pushToolResult(formatResponse.toolResult("Successfully fetched URL but content was empty."))
					return
				}

				let resultMessage = `Successfully fetched content from ${url} (${markdownContent.length} characters)`

				// Save to file if path provided
				if (resolvedSavePath) {
					try {
						await cline.say("text", `正在保存内容到 ${getReadablePath(cline.cwd, resolvedSavePath)}...`)

						// Create directory if it doesn't exist
						const dirPath = path.dirname(resolvedSavePath)
						await fs.promises.mkdir(dirPath, { recursive: true })

						// Write content to file
						await fs.promises.writeFile(resolvedSavePath, `url: ${url}\n\n` + markdownContent, "utf8")

						const relativePath = getReadablePath(cline.cwd, resolvedSavePath)
						resultMessage += ` and saved to ${relativePath}`

						await cline.say("text", `内容已保存到 ${relativePath}`)

						// Track file modification for context
						const workspacePath = getWorkspacePath()
						if (workspacePath && resolvedSavePath.startsWith(workspacePath)) {
							const relativeToWorkspace = path.relative(workspacePath, resolvedSavePath)
							await cline.getFileContextTracker().trackFileContext(relativeToWorkspace, "roo_edited")
						}
					} catch (saveError) {
						await cline.say("error", `保存文件失败: ${saveError}`)
						resultMessage += ` (failed to save to file: ${saveError})`
					}
				}

				await cline.say("text", resultMessage)

				// Return the markdown content
				pushToolResult(formatResponse.toolResult(markdownContent))

				return
			} catch (error) {
				// Ensure browser is closed even on error
				try {
					await cline.urlContentFetcher.closeBrowser()
				} catch (closeError) {
					// Ignore close errors
				}

				await handleError("fetching URL content", error)
				return
			}
		}
	} catch (error) {
		await handleError("fetching URL content", error)
		return
	}
} 