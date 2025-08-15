import * as vscode from "vscode"

import { ClineProvider } from "../core/webview/ClineProvider"
import { ContextProxy } from "../core/config/ContextProxy"
import { telemetryService } from "../services/telemetry/TelemetryService"

import { registerHumanRelayCallback, unregisterHumanRelayCallback, handleHumanRelayResponse } from "./humanRelay"
import { handleNewTask } from "./handleTask"

/**
 * Helper to get the visible ClineProvider instance or log if not found.
 */
export function getVisibleProviderOrLog(outputChannel: vscode.OutputChannel): ClineProvider | undefined {
	const visibleProvider = ClineProvider.getVisibleInstance()
	if (!visibleProvider) {
		outputChannel.appendLine("Cannot find any visible Icemark instances.")
		return undefined
	}
	return visibleProvider
}

// Store panel references in both modes
let sidebarPanel: vscode.WebviewView | undefined = undefined
let tabPanel: vscode.WebviewPanel | undefined = undefined

// Store workspace visibility state
let workspaceVisible = true // 默认显示工作区

/**
 * Get the currently active panel
 * @returns WebviewPanel或WebviewView
 */
export function getPanel(): vscode.WebviewPanel | vscode.WebviewView | undefined {
	return tabPanel || sidebarPanel
}

/**
 * Set panel references
 */
export function setPanel(
	newPanel: vscode.WebviewPanel | vscode.WebviewView | undefined,
	type: "sidebar" | "tab",
): void {
	if (type === "sidebar") {
		sidebarPanel = newPanel as vscode.WebviewView
		tabPanel = undefined
	} else {
		tabPanel = newPanel as vscode.WebviewPanel
		sidebarPanel = undefined
	}
}

export type RegisterCommandOptions = {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
	provider: ClineProvider
}

export const registerCommands = (options: RegisterCommandOptions) => {
	const { context } = options

	for (const [command, callback] of Object.entries(getCommandsMap(options))) {
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}

const getCommandsMap = ({ context, outputChannel, provider }: RegisterCommandOptions) => {
	return {
		"icemark.activationCompleted": () => {},
		"icemark.plusButtonClicked": async () => {
			const visibleProvider = getVisibleProviderOrLog(outputChannel)

			if (!visibleProvider) {
				return
			}

			telemetryService.captureTitleButtonClicked("plus")

			await visibleProvider.removeClineFromStack()
			await visibleProvider.postStateToWebview()
			await visibleProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		},
		"icemark.workspaceButtonClicked": () => {
			const visibleProvider = getVisibleProviderOrLog(outputChannel)

			if (!visibleProvider) {
				return
			}

			telemetryService.captureTitleButtonClicked("workspace")

			// 切换workspace可见状态
			workspaceVisible = !workspaceVisible
			// 设置VSCode上下文，用于控制按钮样式
			vscode.commands.executeCommand("setContext", "icemark.workspaceVisible", workspaceVisible)
			visibleProvider.postMessageToWebview({ type: "action", action: "workspaceButtonClicked" })
		},
		"icemark.workspaceButtonClickedActive": () => {
			const visibleProvider = getVisibleProviderOrLog(outputChannel)

			if (!visibleProvider) {
				return
			}

			telemetryService.captureTitleButtonClicked("workspace")

			// 切换workspace可见状态
			workspaceVisible = !workspaceVisible
			// 设置VSCode上下文，用于控制按钮样式
			vscode.commands.executeCommand("setContext", "icemark.workspaceVisible", workspaceVisible)
			visibleProvider.postMessageToWebview({ type: "action", action: "workspaceButtonClicked" })
		},
		"icemark.mcpButtonClicked": () => {
			const visibleProvider = getVisibleProviderOrLog(outputChannel)

			if (!visibleProvider) {
				return
			}

			telemetryService.captureTitleButtonClicked("mcp")

			visibleProvider.postMessageToWebview({ type: "action", action: "mcpButtonClicked" })
		},
		"icemark.promptsButtonClicked": () => {
			const visibleProvider = getVisibleProviderOrLog(outputChannel)

			if (!visibleProvider) {
				return
			}

			telemetryService.captureTitleButtonClicked("prompts")

			visibleProvider.postMessageToWebview({ type: "action", action: "promptsButtonClicked" })
		},
		"icemark.popoutButtonClicked": () => {
			telemetryService.captureTitleButtonClicked("popout")

			return openClineInNewTab({ context, outputChannel })
		},
		"icemark.openInNewTab": () => openClineInNewTab({ context, outputChannel }),
		"icemark.settingsButtonClicked": () => {
			const visibleProvider = getVisibleProviderOrLog(outputChannel)

			if (!visibleProvider) {
				return
			}

			telemetryService.captureTitleButtonClicked("settings")

			visibleProvider.postMessageToWebview({ type: "action", action: "settingsButtonClicked" })
		},
		"icemark.historyButtonClicked": () => {
			const visibleProvider = getVisibleProviderOrLog(outputChannel)

			if (!visibleProvider) {
				return
			}

			telemetryService.captureTitleButtonClicked("history")

			visibleProvider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
		},
		"icemark.showHumanRelayDialog": (params: { requestId: string; promptText: string }) => {
			const panel = getPanel()

			if (panel) {
				panel?.webview.postMessage({
					type: "showHumanRelayDialog",
					requestId: params.requestId,
					promptText: params.promptText,
				})
			}
		},
		"icemark.registerHumanRelayCallback": registerHumanRelayCallback,
		"icemark.unregisterHumanRelayCallback": unregisterHumanRelayCallback,
		"icemark.handleHumanRelayResponse": handleHumanRelayResponse,
		"icemark.newTask": handleNewTask,
		"icemark.setCustomStoragePath": async () => {
			const { promptForCustomStoragePath } = await import("../shared/storagePathManager")
			await promptForCustomStoragePath()
		},
		"icemark.focusInput": async () => {
			try {
				const panel = getPanel()

				if (!panel) {
					await vscode.commands.executeCommand("workbench.view.extension.icemark-ActivityBar")
				} else if (panel === tabPanel) {
					panel.reveal(vscode.ViewColumn.Active, false)
				} else if (panel === sidebarPanel) {
					await vscode.commands.executeCommand(`${ClineProvider.sideBarId}.focus`)
					provider.postMessageToWebview({ type: "action", action: "focusInput" })
				}
			} catch (error) {
				outputChannel.appendLine(`Error focusing input: ${error}`)
			}
		},
		"icemark.acceptInput": () => {
			const visibleProvider = getVisibleProviderOrLog(outputChannel)

			if (!visibleProvider) {
				return
			}

			visibleProvider.postMessageToWebview({ type: "acceptInput" })
		},
	}
}

export const openClineInNewTab = async ({ context, outputChannel }: Omit<RegisterCommandOptions, "provider">) => {
	const contextProxy = await ContextProxy.getInstance(context)
	const tabProvider = new ClineProvider(context, outputChannel, "editor", contextProxy)
	const lastCol = Math.max(...vscode.window.visibleTextEditors.map((editor) => editor.viewColumn || 0))

	const hasVisibleEditors = vscode.window.visibleTextEditors.length > 0

	if (!hasVisibleEditors) {
		await vscode.commands.executeCommand("workbench.action.newGroupRight")
	}

	const targetCol = hasVisibleEditors ? Math.max(lastCol + 1, 1) : vscode.ViewColumn.Two

	const newPanel = vscode.window.createWebviewPanel(ClineProvider.tabPanelId, "Icemark", targetCol, {
		enableScripts: true,
		retainContextWhenHidden: true,
		localResourceRoots: [context.extensionUri],
	})

	setPanel(newPanel, "tab")

	await tabProvider.resolveWebviewView(newPanel)

	return tabProvider
}
