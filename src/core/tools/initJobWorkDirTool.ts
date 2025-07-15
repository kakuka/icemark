import * as fs from "fs"
import * as path from "path"
import { Cline } from "../Cline"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getWorkspacePath, getReadablePath } from "../../utils/path"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"

export async function initJobWorkDirTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const dirPath: string | undefined = block.params.path
	const folderName: string | undefined = block.params.folder

	// Get the full path and determine if it's outside the workspace
	const workspacePath = getWorkspacePath()
	const fullPath = dirPath && workspacePath ? path.resolve(workspacePath, dirPath) : ""
	const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

	const sharedMessageProps: ClineSayTool = {
		tool: "initJobWorkDir",
		path: dirPath ? getReadablePath(cline.cwd, dirPath) : undefined,
		folder: removeClosingTag("folder", folderName),
		isOutsideWorkspace,
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: undefined } satisfies ClineSayTool)

			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			// Validate required parameters
			if (!dirPath) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("init_job_workdir")
				pushToolResult(await cline.sayAndCreateMissingParamError("init_job_workdir", "path"))
				return
			}

			if (!folderName) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("init_job_workdir")
				pushToolResult(await cline.sayAndCreateMissingParamError("init_job_workdir", "folder"))
				return
			}

			// Validate folder name (no path separators or special characters)
			if (folderName.includes("/") || folderName.includes("\\") || folderName.includes("..")) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("init_job_workdir")
				await cline.say("error", `Roo tried to create directory with invalid folder name '${folderName}'. Folder name cannot contain path separators or '..' sequences. Retrying...`)
				pushToolResult(formatResponse.toolError("Folder name cannot contain path separators (/ or \\) or '..' sequences. Please provide only the folder name."))
				return
			}

			// Validate and resolve paths
			if (!workspacePath) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("init_job_workdir")
				await cline.say("error", "Roo tried to create directory but no workspace is open. Retrying...")
				pushToolResult(formatResponse.toolError("No workspace is open. Please open a workspace first."))
				return
			}

			// Resolve parent directory path relative to workspace
			const parentDirPath = path.resolve(workspacePath, dirPath)
			const targetDirPath = path.join(parentDirPath, folderName)

			// Security check: ensure paths are within workspace
			if (!parentDirPath.startsWith(workspacePath) || !targetDirPath.startsWith(workspacePath)) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("init_job_workdir")
				await cline.say("error", `Roo tried to create directory outside workspace. Retrying...`)
				pushToolResult(formatResponse.toolError("Cannot create directories outside of the workspace. Please provide a path within the workspace."))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Check if target directory already exists
			const dirExists = fs.existsSync(targetDirPath)
			let existsMessage = ""
			if (dirExists) {
				existsMessage = `\n\nDirectory already exists and will be skipped.`
			}

			// Check if parent directory needs to be created
			const parentExists = fs.existsSync(parentDirPath)
			let createParentMessage = ""
			if (!parentExists) {
				createParentMessage = `\n\nParent directory '${path.relative(workspacePath, parentDirPath)}' will be created.`
			}

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: targetDirPath,
				reason: `${createParentMessage}${existsMessage}`,
			} satisfies ClineSayTool)

			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			await cline.say("text", `Creating directory at ${path.relative(workspacePath, targetDirPath)}...`)

			// Check if directory already exists
			if (dirExists) {
				const skipMessage = `Directory '${path.relative(workspacePath, targetDirPath)}' already exists, skipping creation.`
				await cline.say("text", skipMessage)
				pushToolResult(formatResponse.toolResult(skipMessage))
				return
			}

			// Create complete job structure for Assistant-max
			try {
				// Create main directory
				fs.mkdirSync(targetDirPath, { recursive: true })
				
				// Create subdirectories
				const subdirs = [
					'knowledge',
					'task-prompts', 
					'outputs',
					'resources',
					'resources/user',
					'resources/content'
				]
				
				for (const subdir of subdirs) {
					fs.mkdirSync(path.join(targetDirPath, subdir), { recursive: true })
				}
				
				// Create files with empty content
				const filesToCreate = [
					'main_plan.md',
					'knowledge/insights.md',
					'knowledge/terms.md',
					'knowledge/constraints.md',
					'resources/index.md',
					'resources/user-resources-index.md'
				]
				
				for (const filePath of filesToCreate) {
					const fullFilePath = path.join(targetDirPath, filePath)
					fs.writeFileSync(fullFilePath, '', 'utf8')
				}
				
				const relativePath = path.relative(workspacePath, targetDirPath)
				const successMessage = `Successfully created Assistant-max job structure: ${relativePath}\n` +
					`Created directories: knowledge/, task-prompts/, outputs/, resources/, resources/user/, resources/content/\n` +
					`Created files: main_plan.md, insights.md, terms.md, constraints.md, index.md, user-resources-index.md`
				
				await cline.say("text", successMessage)
				pushToolResult(formatResponse.toolResult(successMessage))

				// Track directory creation for context
				await cline.getFileContextTracker().trackFileContext(relativePath, "roo_edited")
				
				// Track created files for context
				for (const filePath of filesToCreate) {
					const relativeFilePath = path.join(relativePath, filePath)
					await cline.getFileContextTracker().trackFileContext(relativeFilePath, "roo_edited")
				}
				
				return
			} catch (error) {
				await handleError("creating job structure", error)
				return
			}
		}
	} catch (error) {
		await handleError("initializing job work directory", error)
		return
	}
} 