import * as fs from "fs"
import * as path from "path"
import { Cline } from "../Cline"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getWorkspacePath, getReadablePath } from "../../utils/path"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"

export async function saveResourceTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const uri: string | undefined = block.params.uri
	const folder: string | undefined = block.params.folder
	const filename: string | undefined = block.params.filename

	// Get the full path and determine if it's outside the workspace
	const workspacePath = getWorkspacePath()
	const fullPath = folder && workspacePath ? path.resolve(workspacePath, folder) : ""
	const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

	const sharedMessageProps: ClineSayTool = {
		tool: "saveResource",
		uri: removeClosingTag("uri", uri),
		folder: removeClosingTag("folder", folder),
		filename: removeClosingTag("filename", filename),
		path: folder && filename ? getReadablePath(cline.cwd, path.join(folder, filename)) : undefined,
		isOutsideWorkspace,
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: undefined } satisfies ClineSayTool)

			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			// Validate required parameters
			if (!uri) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("save_resource")
				pushToolResult(await cline.sayAndCreateMissingParamError("save_resource", "uri"))
				return
			}

			if (!folder) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("save_resource")
				pushToolResult(await cline.sayAndCreateMissingParamError("save_resource", "folder"))
				return
			}

			if (!filename) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("save_resource")
				pushToolResult(await cline.sayAndCreateMissingParamError("save_resource", "filename"))
				return
			}

			// Validate filename (no path separators)
			if (filename.includes("/") || filename.includes("\\")) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("save_resource")
				await cline.say("error", `Roo tried to save resource with invalid filename '${filename}'. Filename cannot contain path separators. Retrying...`)
				pushToolResult(formatResponse.toolError("Filename cannot contain path separators (/ or \\). Please provide only the filename without directories."))
				return
			}

			// Validate and resolve paths
			const workspacePath = getWorkspacePath()
			if (!workspacePath) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("save_resource")
				await cline.say("error", "Roo tried to save resource but no workspace is open. Retrying...")
				pushToolResult(formatResponse.toolError("No workspace is open. Please open a workspace first."))
				return
			}

			// Resolve folder path relative to workspace
			const targetFolderPath = path.resolve(workspacePath, folder)
			const targetFilePath = path.join(targetFolderPath, filename)

			// Security check: ensure paths are within workspace
			if (!targetFolderPath.startsWith(workspacePath) || !targetFilePath.startsWith(workspacePath)) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("save_resource")
				await cline.say("error", `Roo tried to save resource outside workspace. Retrying...`)
				pushToolResult(formatResponse.toolError("Cannot save files outside of the workspace. Please provide a path within the workspace."))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Check if target file already exists
			const fileExists = fs.existsSync(targetFilePath)
			let overwriteMessage = ""
			if (fileExists) {
				overwriteMessage = `\n\nWARNING: File '${path.relative(workspacePath, targetFilePath)}' already exists and will be overwritten.`
			}

			// Check if directory needs to be created
			const dirExists = fs.existsSync(targetFolderPath)
			let createDirMessage = ""
			if (!dirExists) {
				createDirMessage = `\n\nDirectory '${path.relative(workspacePath, targetFolderPath)}' will be created.`
			}

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: targetFilePath,
				reason: `${createDirMessage}${overwriteMessage}`,
			} satisfies ClineSayTool)

			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			await cline.say("text", `Saving resource URI to ${path.relative(workspacePath, targetFilePath)}...`)

			// Create directory if it doesn't exist
			if (!dirExists) {
				try {
					fs.mkdirSync(targetFolderPath, { recursive: true })
					await cline.say("text", `Created directory: ${path.relative(workspacePath, targetFolderPath)}`)
				} catch (error) {
					await handleError("creating directory", error)
					return
				}
			}

			// Try to fetch web page content using MCP
			let contentToSave = uri
			let contentDescription = "resource URI"
			
			try {
				await cline.say("text", `Fetching content from ${uri} using MCP web_page_detail tool...`)
				
				const toolResult = await cline.providerRef
					.deref()
					?.getMcpHub()
					?.callTool("icemark-mcp-streamable", "web_page_detail", { url: uri, need_urls_in_page: "false" })
				
				if (toolResult && !toolResult.isError && toolResult.content && toolResult.content.length > 0) {
					// Extract text content from MCP response
					const textContent = toolResult.content
						.map((item) => {
							if (item.type === "text") {
								return item.text
							}
							return ""
						})
						.filter(Boolean)
						.join("\n\n")
					
					if (textContent && textContent.trim()) {
						// Try to parse the JSON response
						try {
							const jsonData = JSON.parse(textContent)
							
							// Format JSON data as key-value pairs
							const formattedContent = Object.entries(jsonData)
								.map(([key, value]) => `${key}：\n${value}`)
								.join("\n\n")
							
							if (formattedContent) {
								contentToSave = formattedContent
								contentDescription = "formatted web page data"
								await cline.say("text", `Successfully parsed and formatted JSON data with ${Object.keys(jsonData).length} fields`)
							} else {
								contentToSave = textContent
								contentDescription = "web page content"
								await cline.say("text", `JSON parsing resulted in empty content, using raw text instead`)
							}
						} catch (parseError) {
							// If parsing fails, use the raw text content
							contentToSave = textContent
							contentDescription = "web page content"
							await cline.say("text", `Content is not valid JSON, saving as raw text (${textContent.length} characters)`)
						}
					} else {
						await cline.say("text", "MCP returned empty content, saving URI instead")
                        contentToSave = 'MCP returned empty content, saving URI instead.\n' + contentToSave 
					}
				} else {
					const errorMsg = toolResult?.isError ? "MCP tool returned error" : "MCP tool returned no content"
					await cline.say("text", `${errorMsg}, saving URI instead`)
				}
			} catch (mcpError) {
				await cline.say("text", `Failed to fetch content via MCP (${mcpError}), saving URI instead`)
			}

			// Write the content (either web page content or URI fallback) to the file
			try {
				fs.writeFileSync(targetFilePath, contentToSave, "utf8")
				
				const relativePath = path.relative(workspacePath, targetFilePath)
				const successMessage = `Successfully saved ${contentDescription} to ${relativePath}`
				
				await cline.say("text", successMessage)
				pushToolResult(formatResponse.toolResult(successMessage))

				// Track file modification for context
				await cline.getFileContextTracker().trackFileContext(relativePath, "roo_edited")
				
				return
			} catch (error) {
				await handleError("writing file", error)
				return
			}
		}
	} catch (error) {
		await handleError("saving resource", error)
		return
	}
} 