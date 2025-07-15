import { Cline } from "../Cline"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"

export async function prototypeTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	const action: string | undefined = block.params.action
	const path: string | undefined = block.params.path
	const argumentsParam: string | undefined = block.params.arguments

	const sharedMessageProps: ClineSayTool = {
		tool: "prototype",
		action: removeClosingTag("action", action),
		path: removeClosingTag("path", path),
		content: removeClosingTag("arguments", argumentsParam),
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: undefined } satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			// 验证必需参数
			if (!action) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("prototype")
				pushToolResult(await cline.sayAndCreateMissingParamError("prototype", "action"))
				return
			}

			if (!path) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("prototype")
				pushToolResult(await cline.sayAndCreateMissingParamError("prototype", "path"))
				return
			}

			// 验证action参数
			const validActions = ["init", "show"]
			if (!validActions.includes(action)) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("prototype")
				await cline.say(
					"error",
					`Icemark tried to use invalid action '${action}'. Valid actions are: ${validActions.join(", ")}. Retrying...`,
				)
				pushToolResult(
					formatResponse.toolError(
						`Invalid action: ${action}. Valid actions are: ${validActions.join(", ")}`,
					),
				)
				return
			}

			// 验证path格式
			if (!isValidPrototypePath(path)) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("prototype")
				await cline.say(
					"error",
					`Icemark tried to use invalid path format '${path}'. Path must end with .mmd, .excalidraw, .excalidraw.json, -html-web, or -html-mobile. Please check the path and try again.`,
				)
				pushToolResult(
					formatResponse.toolError(
						`Invalid path format: ${path}. Must end with .mmd, .excalidraw, .excalidraw.json, -html-web, or -html-mobile`,
					),
				)
				return
			}

			// 解析arguments参数
			let actionParams: any = {}
			if (argumentsParam) {
				try {
					actionParams = JSON.parse(argumentsParam)
				} catch (error) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("prototype")
					await cline.say(
						"error",
						`Icemark tried to use invalid JSON in arguments parameter: ${error}. Retrying...`,
					)
					pushToolResult(formatResponse.toolError(`Invalid JSON in arguments parameter: ${error}`))
					return
				}
			}

			cline.consecutiveMistakeCount = 0

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: `Action: ${action}, Path: ${path}${argumentsParam ? `, Options: ${argumentsParam}` : ""}`,
			} satisfies ClineSayTool)

			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			// 调用相应的方法
			const result = action === 'init' 
				? await cline.prototypeService.init(path, actionParams)
				: await cline.prototypeService.show(path, actionParams)

			// 根据结果显示UI反馈
			if (result.success) {
				await cline.say("text", result.message)
				pushToolResult(formatResponse.toolResult(result.message))
			} else {
				await cline.say("error", result.message)
				pushToolResult(formatResponse.toolError(result.message))
			}
		}
	} catch (error) {
		await handleError("using prototype tool", error)
		return
	}
}

function isValidPrototypePath(path: string): boolean {
	return path.endsWith('.mmd') || 
		   path.endsWith('.excalidraw') || 
		   path.endsWith('.excalidraw.json') || 
		   path.endsWith('-html-web') || 
		   path.endsWith('-html-mobile')
}


