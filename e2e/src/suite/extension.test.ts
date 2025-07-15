import * as assert from "assert"
import * as vscode from "vscode"

suite("Icemark Extension", () => {
	test("Commands should be registered", async () => {
		const expectedCommands = [
			"icemark.plusButtonClicked",
			"icemark.mcpButtonClicked",
			"icemark.historyButtonClicked",
			"icemark.popoutButtonClicked",
			"icemark.settingsButtonClicked",
			"icemark.openInNewTab",
			"icemark.explainCode",
			"icemark.fixCode",
			"icemark.improveCode",
		]

		const commands = await vscode.commands.getCommands(true)

		for (const cmd of expectedCommands) {
			assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`)
		}
	})
})
