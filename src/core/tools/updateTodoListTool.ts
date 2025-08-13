import { Cline } from "../Cline"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"

export async function updateTodoListTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const todosParam: string | undefined = block.params.todos
	const reasonParam: string | undefined = block.params.reason

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				tool: "updateTodoList",
				reason: removeClosingTag("reason", reasonParam),
			})
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!todosParam) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("update_todo_list")
				pushToolResult(await cline.sayAndCreateMissingParamError("update_todo_list", "todos"))
				return
			}

			let parsedTodos: any
			try {
				parsedTodos = JSON.parse(todosParam)
			} catch (error) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("update_todo_list")
				await cline.say("error", `Icemark tried to update todo list with invalid JSON. Retrying...`)
				pushToolResult(
					formatResponse.toolError(
						"Invalid JSON for <todos>. Provide a valid JSON object or array with 3-state items.",
					),
				)
				return
			}

			// Strict validation: only {id, content, status, children?} are allowed. status ∈ {pending,in_progress,completed}
			const normalized = normalizeAndValidate(parsedTodos)
			if (typeof normalized === "string") {
				cline.consecutiveMistakeCount++
				cline.recordToolError("update_todo_list")
				pushToolResult(formatResponse.toolError(normalized))
				return
			}

			// Ask approval with lightweight payload (summary only)
			// const summary = {
			// 	total: normalized.totalCount,
			// 	completed: normalized.completedCount,
			// 	inProgress: normalized.items.filter((i) => i.status === "in_progress").length,
			// }
			// const completeMessage = JSON.stringify({
			// 	tool: "updateTodoList",
			// 	reason: removeClosingTag("reason", reasonParam),
			// 	summary,
			// })
			// const didApprove = await askApproval("tool", completeMessage)
			// if (!didApprove) {
			// 	return
			// }

			// Apply change after approval
			const provider = cline.providerRef.deref()
			if (!provider) {
				pushToolResult(formatResponse.toolError("Provider is not available."))
				return
			}
			;(provider as any).setTaskTodoList?.(cline.taskId, normalized)
			await provider.postStateToWebview()

			cline.consecutiveMistakeCount = 0
			pushToolResult(formatResponse.toolResult("Updated todo list successfully"))
			return
		}
	} catch (error) {
		await handleError("updating todo list", error as Error)
		return
	}
}

function normalizeAndValidate(input: any): { items: TodoItem[]; completedCount: number; totalCount: number } | string {
	const items: any[] = Array.isArray(input) ? input : Array.isArray(input?.items) ? input.items : []
	if (!Array.isArray(items) || items.length === 0) {
		return "Invalid todos: provide {\"items\":[...]} or a non-empty array of items."
	}
	const allowedStatuses = new Set(["pending", "in_progress", "completed"]) as Set<string>
	const walk = (arr: any[], level: number, parentId?: string): TodoItem[] => {
		return arr.map((raw: any, idx: number) => {
			// hard reject deprecated fields
			if (raw && ("done" in raw || "title" in raw)) {
				throw new Error(
					"Invalid todos: Only 3-state 'status' is allowed. Fields 'done' or 'title' are not permitted. Use { id, content, status, children? }.",
				)
			}
			if (!raw || typeof raw.content !== "string" || raw.content.trim() === "") {
				throw new Error("Invalid todos: each item requires non-empty 'content' string.")
			}
			if (!allowedStatuses.has(raw.status)) {
				throw new Error("Invalid todos: 'status' must be one of pending | in_progress | completed.")
			}
			const id: string = typeof raw.id === "string" && raw.id.trim() !== "" ? raw.id : `${parentId ?? ""}${level}-${idx}`
			const children = Array.isArray(raw.children) ? walk(raw.children, level + 1, `${id}.`) : undefined
			return { id, content: raw.content, status: raw.status, children }
		})
	}

	let out: TodoItem[]
	try {
		out = walk(items, 0)
	} catch (e: any) {
		return e?.message || "Invalid todos."
	}

	const totalCount = out.length
	const completedCount = out.filter((i) => i.status === "completed").length
	return { items: out, completedCount, totalCount }
}

type TodoStatus = "pending" | "in_progress" | "completed"
interface TodoItem {
	id: string
	content: string
	status: TodoStatus
	children?: TodoItem[]
} 