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
	const actionParam: string | undefined = block.params.action
	const reasonParam: string | undefined = block.params.reason

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({
				tool: "updateTodoList",
				action: removeClosingTag("action", actionParam),
				reason: removeClosingTag("reason", reasonParam),
			})
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			// Validate action parameter
			if (!actionParam || !["init", "update"].includes(actionParam)) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("update_todo_list")
				pushToolResult(formatResponse.toolError(
					`Invalid or missing <action>. Use "init" or "update".`
				))
				return
			}

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

			let normalized: { items: TodoItem[]; completedCount: number; totalCount: number }

			if (actionParam === "init") {
				// Init mode: full validation and replacement
				const initResult = normalizeAndValidate(parsedTodos)
				if (typeof initResult === "string") {
					cline.consecutiveMistakeCount++
					cline.recordToolError("update_todo_list")
					pushToolResult(formatResponse.toolError(initResult))
					return
				}
				normalized = initResult
			} else {
				// Update mode: incremental updates by id
				const provider = cline.providerRef.deref()
				if (!provider) {
					pushToolResult(formatResponse.toolError("Provider is not available."))
					return
				}

				const currentTodoList = (provider as any).getTaskTodoList?.(cline.taskId)
				if (!currentTodoList || !currentTodoList.items || !Array.isArray(currentTodoList.items)) {
					cline.consecutiveMistakeCount++
					cline.recordToolError("update_todo_list")
					pushToolResult(formatResponse.toolError(
						"No existing todo list found. Use action=\"init\" to initialize first."
					))
					return
				}

				const updateResult = applyUpdates(currentTodoList, parsedTodos)
				if (typeof updateResult === "string") {
					cline.consecutiveMistakeCount++
					cline.recordToolError("update_todo_list")
					pushToolResult(formatResponse.toolError(updateResult))
					return
				}
				normalized = updateResult
			}

			const completeMessage = JSON.stringify({
				tool: "updateTodoList",
				action: actionParam,
				reason: removeClosingTag("reason", reasonParam),
				items: normalized.items,
				total: normalized.totalCount,
				completed: normalized.completedCount,
			})
			
			// 用"完成版"替换之前的 partial 工具消息
			await cline.ask("tool", completeMessage, false)

			// Apply change after approval
			const provider = cline.providerRef.deref()
			if (!provider) {
				pushToolResult(formatResponse.toolError("Provider is not available."))
				return
			}
			;(provider as any).setTaskTodoList?.(cline.taskId, normalized)
			
			cline.consecutiveMistakeCount = 0
			pushToolResult(formatResponse.toolResult("Updated todo list successfully"))
			return
		}
	} catch (error) {
		await handleError("updating todo list", error as Error)
		return
	}
}

function applyUpdates(currentTodoList: any, updateData: any): { items: TodoItem[]; completedCount: number; totalCount: number } | string {
	const updateItems: any[] = Array.isArray(updateData) ? updateData : Array.isArray(updateData?.items) ? updateData.items : []
	
	if (!Array.isArray(updateItems) || updateItems.length === 0) {
		return "Invalid todos for update: provide {\"items\":[...]} or a non-empty array of items."
	}

	// Validate update items
	for (const item of updateItems) {
		if (!item || typeof item.id !== "string" || item.id.trim() === "") {
			return "Invalid todos for update: each item must include a non-empty 'id' string."
		}
		
		const hasStatus = "status" in item
		const hasContent = "content" in item
		
		if (!hasStatus && !hasContent) {
			return "Invalid todos for update: each item must include at least one of 'status' or 'content'."
		}
		
		if (hasStatus && !["pending", "in_progress", "completed"].includes(item.status)) {
			return "Invalid todos for update: 'status' must be one of pending | in_progress | completed."
		}
		
		if (hasContent && (typeof item.content !== "string" || item.content.trim() === "")) {
			return "Invalid todos for update: 'content' must be a non-empty string."
		}
	}

	// Create a flat map of all items by id for fast lookup
	const flatItemMap = new Map<string, TodoItem>()
	const collectItems = (items: TodoItem[]) => {
		for (const item of items) {
			flatItemMap.set(item.id, item)
			if (item.children) {
				collectItems(item.children)
			}
		}
	}
	collectItems(currentTodoList.items)

	// Check if all update ids exist
	for (const updateItem of updateItems) {
		if (!flatItemMap.has(updateItem.id)) {
			return `Update failed: id "${updateItem.id}" not found in current todo list. Use action="init" to rebuild if needed.`
		}
	}

	// Apply updates
	for (const updateItem of updateItems) {
		const existingItem = flatItemMap.get(updateItem.id)!
		if ("status" in updateItem) {
			existingItem.status = updateItem.status
		}
		if ("content" in updateItem) {
			existingItem.content = updateItem.content
		}
	}

	// Recalculate counts
	const { completedCount, totalCount } = calculateCounts(currentTodoList.items)
	
	return {
		items: currentTodoList.items,
		completedCount,
		totalCount
	}
}

function calculateCounts(items: TodoItem[]): { completedCount: number; totalCount: number } {
	let completedCount = 0
	let totalCount = 0
	
	const countItems = (itemList: TodoItem[]) => {
		for (const item of itemList) {
			totalCount++
			if (item.status === "completed") {
				completedCount++
			}
			if (item.children) {
				countItems(item.children)
			}
		}
	}
	
	countItems(items)
	return { completedCount, totalCount }
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

	const { completedCount, totalCount } = calculateCounts(out)
	return { items: out, completedCount, totalCount }
}

type TodoStatus = "pending" | "in_progress" | "completed"
interface TodoItem {
	id: string
	content: string
	status: TodoStatus
	children?: TodoItem[]
} 