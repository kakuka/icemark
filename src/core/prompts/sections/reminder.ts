export function formatUserReminderSection(reminderText?: string): string {
	if (!reminderText || !reminderText.trim()) {
		return ""
	}
	
	const lines = [
		"====",
		"",
		"USER REMINDERS",
		"",
		"The user has set the following reminders that should be followed throughout this task:",
		"",
		reminderText.trim(),
		"",
		"====",
	]
	
	return lines.join("\n")
} 