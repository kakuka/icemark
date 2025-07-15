import * as path from "path"
import * as dotenv from "dotenv"

import { runTests } from "@vscode/test-electron"

// Load environment variables from .env.local file
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") })

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, "../../")

		// The path to the extension test script
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, "./suite/index")

		// The path to the workspace to open for testing, loaded from environment variables.
		const testWorkspace = process.env.E2E_TEST_WORKSPACE

		if (!testWorkspace) {
			console.log("No test workspace provided, running tests without workspace")
			await runTests({
				extensionDevelopmentPath,
				extensionTestsPath,
				// Pass the workspace path to VS Code as a launch argument
			})
		} else {
			await runTests({
				extensionDevelopmentPath,
				extensionTestsPath,
				launchArgs: [testWorkspace],
				// Pass the workspace path to VS Code as a launch argument
			})
		}

		// Download VS Code, unzip it and run the integration test
		// await runTests({
		// 	extensionDevelopmentPath,
		// 	extensionTestsPath,
		// 	// Pass the workspace path to VS Code as a launch argument

		// })
	} catch (err) {
		console.error("Failed to run tests", err)
		process.exit(1)
	}
}

main()
