export function getUpdateTodoListDescription(): string {
	return `## update_todo_list
Description: Update the current task's todo list using STRICT 3-state items. You must provide only these fields per item: id, content, status (one of: pending | in_progress | completed), and optional children[]. Do not use deprecated fields like done or title.
Parameters:
- action: (required) "init" or "update"
  - "init": Initialize or completely replace the todo list with full validation
  - "update": Update specific items by id (only status/content changes, no structural changes)
- todos: (required) JSON object of shape { "items": TodoItem[] } OR a plain array TodoItem[] where:
  - For "init": TodoItem = { id: string, content: string, status: "pending"|"in_progress"|"completed", children?: TodoItem[] }
  - For "update": TodoItem = { id: string, status?: "pending"|"in_progress"|"completed", content?: string }
- reason: (optional) Reason for updating

Rules:
1) action is REQUIRED and must be "init" or "update".
2) For "init": status and content are REQUIRED for each item. Fields 'done' or 'title' are NOT allowed.
3) For "update": id is REQUIRED, and at least one of status or content must be provided.
4) For "update": All ids must exist in current todo list.
5) status must be one of: pending, in_progress, completed.
6) content must be non-empty string when provided.

Multi-level tasks (init mode only):
- You can build multi-level task trees by nesting "children" recursively.
- Each child item MUST follow the same schema: { id, content, status, children? }.
- Keep ids unique (recommend hierarchical ids like "1", "1.1", "1.1.1").

Usage Examples:

1) Initialize list (action="init"):
<update_todo_list>
<action>init</action>
<todos>{"items":[
  {"id":"1","content":"创建 a.txt","status":"pending"},
  {"id":"2","content":"创建 b.txt","status":"pending"},
  {"id":"3","content":"创建 c.txt","status":"pending"}
]}</todos>
<reason>初始化待办</reason>
</update_todo_list>

2) Update specific items by id (action="update"):
<update_todo_list>
<action>update</action>
<todos>{"items":[
  {"id":"1","status":"completed"},
  {"id":"3","content":"创建 d.txt","status":"pending"}
]}</todos>
</update_todo_list>

3) Initialize with subtasks:
<update_todo_list>
<action>init</action>
<todos>{"items":[
  {"id":"1","content":"创建 a.txt","status":"completed","children":[
    {"id":"1.1","content":"写入初始内容","status":"completed"}
  ]},
  {"id":"2","content":"创建 b.txt","status":"pending"}
]}</todos>
</update_todo_list>

4) Update only status:
<update_todo_list>
<action>update</action>
<todos>{"items":[
  {"id":"2","status":"in_progress"}
]}</todos>
</update_todo_list>`
} 