export function getUpdateTodoListDescription(): string {
	return `## update_todo_list
Description: Update the current task's todo list using STRICT 3-state items. You must provide only these fields per item: id, content, status (one of: pending | in_progress | completed), and optional children[]. Do not use deprecated fields like done or title.
Parameters:
- todos: (required) JSON object of shape { "items": TodoItem[] } OR a plain array TodoItem[] where:
  - TodoItem = { id: string, content: string, status: "pending"|"in_progress"|"completed", children?: TodoItem[] }
- reason: (optional) Reason for updating

Rules:
1) status is REQUIRED and must be one of: pending, in_progress, completed.
2) content is REQUIRED (string, non-empty).
3) Fields 'done' or 'title' are NOT allowed. If present, the tool call will be rejected.
4) Prefer small, incremental updates.

Multi-level tasks:
- You can build multi-level task trees by nesting "children" recursively.
- Each child item MUST follow the same schema: { id, content, status, children? }.
- Keep ids unique (recommend hierarchical ids like "1", "1.1", "1.1.1").
- Depth is allowed as needed, but avoid excessively large trees in a single update.

Usage Examples:

1) Initialize list (all pending):
<update_todo_list>
<todos>{"items":[
  {"id":"1","content":"创建 a.txt","status":"pending"},
  {"id":"2","content":"创建 b.txt","status":"pending"}
]}</todos>
<reason>初始化待办</reason>
</update_todo_list>

2) Mark an item in progress:
<update_todo_list>
<todos>{"items":[
  {"id":"1","content":"创建 a.txt","status":"in_progress"},
  {"id":"2","content":"创建 b.txt","status":"pending"}
]}</todos>
</update_todo_list>

3) Complete an item and include subtasks:
<update_todo_list>
<todos>{"items":[
  {"id":"1","content":"创建 a.txt","status":"completed","children":[
    {"id":"1.1","content":"写入初始内容","status":"completed"}
  ]},
  {"id":"2","content":"创建 b.txt","status":"pending"}
]}</todos>
</update_todo_list>`
} 