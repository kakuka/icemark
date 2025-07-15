import * as assert from "assert"

import type { ClineMessage } from "../../../src/exports/roo-code"

import { waitUntilCompleted } from "./utils"

suite("Icemark Task", () => {
	test("Should handle prompt and response correctly", async () => {
		const api = globalThis.api

		const messages: ClineMessage[] = []

		api.on("message", ({ message }) => {
			if (message.type === "say" && message.partial === false) {
				messages.push(message)
			}
		})

		const taskId = await api.startNewTask({
			configuration: { mode: "icemark", alwaysAllowModeSwitch: true, autoApprovalEnabled: true },
			text: "Hello world, what is your name? Respond with 'My name is ...'",
		})

		await waitUntilCompleted({ api, taskId })

		assert.ok(
			!!messages.find(
				({ say, text }) => (say === "completion_result" || say === "text") && text?.includes("My name is Icemark"),
			),
			`Completion should include "My name is Icemark"`,
		)
	})
})
