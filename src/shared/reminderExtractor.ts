/*
Reminder extraction utility:
- **Purpose**: 
  - To identify and extract reminder content from user input text that uses <reminder>content</reminder> tags.
  - Similar to mention mechanism but for user reminders that should persist throughout the task.
  - Supports multiple reminder tags and multiline content.

- **Regex Breakdown**:
  - `<reminder>`: Opening tag that starts the reminder content.
  - `(.*?)`: Non-greedy capture group that matches any content including newlines.
  - `</reminder>`: Closing tag that ends the reminder content.
  - `g`: Global flag to match all occurrences in the text.
  - `s`: Dotall flag to make `.` match newline characters.

- **Usage**:
  - Extract reminder content from user input during task creation.
  - Store extracted content in task reminder map for persistent context.
  - Original text remains unchanged for task processing.

- **Examples**:
  - Input: "Create a website <reminder>Use React and TypeScript</reminder>"
  - Extracted: "Use React and TypeScript"
  - Input: "Build app <reminder>Theme: dark mode</reminder> and <reminder>Deploy to AWS</reminder>"
  - Extracted: "Theme: dark mode\n\nDeploy to AWS"
*/

export const reminderRegex = /<reminder>([\s\S]*?)<\/reminder>/g

export function extractReminder(text: string): string {
	if (!text) {
		return ""
	}

	// Reset regex lastIndex to ensure consistent behavior with global flag
	reminderRegex.lastIndex = 0
	const matches: RegExpExecArray[] = []
	let match: RegExpExecArray | null
	while ((match = reminderRegex.exec(text)) !== null) {
		matches.push(match)
	}

	if (matches.length === 0) {
		return ""
	}

	// Extract all reminder contents and filter out empty ones
	const reminderContents = matches.map((match) => match[1].trim()).filter((content) => content.length > 0)

	// Join multiple reminders with double newlines for clarity
	return reminderContents.join("\n\n")
}

export function hasReminder(text: string): boolean {
	if (!text) {
		return false
	}
	// Reset regex lastIndex to ensure consistent behavior with global flag
	reminderRegex.lastIndex = 0
	return reminderRegex.test(text)
}
