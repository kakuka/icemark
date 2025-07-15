export function getInitJobWorkDirDescription(): string {
	return `## init_job_workdir
Description: Initialize a complete job working directory structure for Assistant-max mode. This tool creates a standardized directory structure with all necessary files and folders for complex task management and execution.
Parameters:
- path: (required) The parent directory path where the job structure will be created (relative to workspace root)
- folder: (required) The job folder name, typically in format "job_{主题}_{YYYYMMDD}"
Usage:
<init_job_workdir>
<path>parent/directory/path</path>
<folder>job_topic_20240115</folder>
</init_job_workdir>

Directory Structure Created:
\`\`\`
job_{主题}_{日期}/
├── main_plan.md              # Main planning file (empty)
├── knowledge/                # Knowledge base directory
│   ├── insights.md          # Key insights (empty)
│   ├── terms.md             # Term definitions (empty)
│   └── constraints.md       # Constraint conditions (empty)
├── task-prompts/            # Sub-task prompt files directory
├── outputs/                 # Task outputs directory
└── resources/               # Resource files directory
    └── index.md             # Resource index (empty)
\`\`\`

Examples:

1. Create a job structure for AI tools research:
<init_job_workdir>
<path>.</path>
<folder>job_AI工具调研_20240115</folder>
</init_job_workdir>

2. Create a job structure in a projects directory:
<init_job_workdir>
<path>projects</path>
<folder>job_数据分析_20240115</folder>
</init_job_workdir>

3. Create a job structure for code review:
<init_job_workdir>
<path>workspace</path>
<folder>job_代码审查_20240115</folder>
</init_job_workdir>

Note: This tool is specifically designed for Assistant-max workflow. It creates a complete standardized structure with all necessary directories and empty files. If the target folder already exists, the operation will be skipped. All created files will be empty and ready for content.`
} 