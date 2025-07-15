import * as path from "path"
import * as fs from "fs/promises"
import Mocha from "mocha"
import { glob } from "glob"
import * as vscode from "vscode"

import type { RooCodeAPI } from "../../../src/exports/roo-code"

import { waitFor } from "./utils"

declare global {
	var api: RooCodeAPI
}

export async function run() {
	const extensionId = "icemark-tech.icemark-agent"
	const extension = vscode.extensions.getExtension<RooCodeAPI>(extensionId)

	if (!extension) {
		throw new Error("Extension not found")
	}

	// --- Start: Clean global storage before running tests ---
	// Construct the path to the global storage for this extension
	const globalStoragePath = path.join(
		path.resolve(__dirname, "../../.vscode-test/user-data/User/globalStorage/"),
		extensionId,
	)

	// Clean up the global storage from previous runs
	try {
		console.log(`Cleaning global storage: ${globalStoragePath}`)
		await fs.rm(globalStoragePath, { recursive: true, force: true })
		console.log(`Successfully cleaned global storage: ${globalStoragePath}`)
	} catch (err) {
		console.error(`Error cleaning global storage: ${globalStoragePath}`, err)
		// We can choose to either throw or just log the error.
		// For robustness, we'll log it and continue.
	}
	// --- End: Clean global storage ---

	const api = extension.isActive ? extension.exports : await extension.activate()

	await api.setConfiguration({
		apiProvider: "openrouter" as const,
		openRouterApiKey: process.env.OPENROUTER_API_KEY!,
		openRouterModelId: "deepseek/deepseek-r1-0528:free",
	})

	await vscode.commands.executeCommand("icemark.SidebarProvider.focus")
	await waitFor(() => api.isReady())

	// Expose the API to the tests.
	globalThis.api = api

	// Add all the tests to the runner.
	const mocha = new Mocha({ ui: "tdd", timeout: 1000_000 })
	const cwd = path.resolve(__dirname, "..")
	;(await glob("**/**.test.js", { cwd })).forEach((testFile) => mocha.addFile(path.resolve(cwd, testFile)))

	// Let's go!
	return new Promise<void>((resolve, reject) =>
		mocha.run((failures) => (failures === 0 ? resolve() : reject(new Error(`${failures} tests failed.`)))),
	)
}
