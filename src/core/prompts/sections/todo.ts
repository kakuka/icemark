export type TodoItem = { id?: string; title?: string; done?: boolean; note?: string; children?: TodoItem[]; status?: "pending"|"in_progress"|"completed"; content?: string }
export type TodoList = { items?: TodoItem[]; completedCount?: number; totalCount?: number }

export function formatReminderSection(todoList?: TodoItem[] | TodoList): string {
	const items: TodoItem[] = Array.isArray((todoList as any))
		? (todoList as TodoItem[])
		: Array.isArray((todoList as TodoList)?.items)
			? ((todoList as TodoList).items as TodoItem[])
			: []
	if (!items || items.length === 0) return ""

	const statusMap: Record<string, string> = {
		pending: "Pending",
		in_progress: "In Progress",
		completed: "Completed",
	}

	const lines: string[] = [
		"====",
		"",
		"REMINDERS",
		"",
		"Below is your current list of reminders for this task. Keep them updated as you progress.",
		"",
	]

	lines.push("| # | Content | Status |")
	lines.push("|---|---------|--------|")
	items.forEach((item, idx) => {
		const content = (item.title ?? item.content ?? "").toString()
		const escaped = content.replace(/\\/g, "\\\\").replace(/\|/g, "\\|")
		const status = item.status
			? statusMap[item.status] || item.status
			: item.done === true
				? "Completed"
				: "Pending"
		lines.push(`| ${idx + 1} | ${escaped} | ${status} |`)
	})
	lines.push("")
	lines.push(
		"",
		"IMPORTANT: When task status changes, remember to call the `update_todo_list` tool to update your progress.",
		"",
	)
	return lines.join("\n")
} 