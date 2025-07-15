import * as assert from "assert"

import type { ClineMessage } from "../../../src/exports/roo-code"

import { waitUntilCompleted } from "./utils"

suite("Icemark Modes", () => {
	test("Should handle switching modes correctly", async () => {
		const api = globalThis.api

		/**
		 * Switch modes.
		 */

		const switchModesPrompt =
			"For each mode (market, prd) , switch to that mode, and then respond with the mode name and what it specializes in after switching to that mode."

		let messages: ClineMessage[] = []

		const modeSwitches: string[] = []

		api.on("taskModeSwitched", (_taskId, mode) => {
			console.log("taskModeSwitched", mode)
			modeSwitches.push(mode)
		})

		api.on("message", ({ message }) => {
			if (message.type === "say" && message.partial === false) {
				messages.push(message)
			}
		})

		const switchModesTaskId = await api.startNewTask({
			configuration: { mode: "icemark", alwaysAllowModeSwitch: true, autoApprovalEnabled: true },
			text: switchModesPrompt,
		})

		await waitUntilCompleted({ api, taskId: switchModesTaskId })
		await api.cancelCurrentTask()

		//assert.ok(modeSwitches.includes("Icemark"))
		assert.ok(modeSwitches.includes("market"))
		assert.ok(modeSwitches.includes("prd"))
	})
})
