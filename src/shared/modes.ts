import * as vscode from "vscode"

import { GroupOptions, GroupEntry, ModeConfig, PromptComponent, CustomModePrompts, ExperimentId } from "../schemas"
import { TOOL_GROUPS, ToolGroup, ALWAYS_AVAILABLE_TOOLS } from "./tools"
import { addCustomInstructions } from "../core/prompts/sections/custom-instructions"
import { EXPERIMENT_IDS } from "./experiments"
// import { assistantModePrompt } from "./mode-prompts/assistant"
// import { assistantMaxModePrompt } from "./mode-prompts/assistant-max"
// import { assistantProModePrompt } from "./mode-prompts/assistant-pro"
// import { assistantWorkerModePrompt } from "./mode-prompts/assistant-worker"
// import { resourceManagerModePrompt } from "./mode-prompts/resource-manager"
import { marketModePrompt } from "./mode-prompts/market"
import { prdModePrompt } from "./mode-prompts/prd"
import { prototypeModePrompt } from "./mode-prompts/prototype"
// import { planModePrompt } from "./mode-prompts/plan"
// import { managerModePrompt } from "./mode-prompts/manager"
// import { pmModePrompt } from "./mode-prompts/pm"
import { icemarkModePrompt } from "./mode-prompts/icemark"

export type Mode = string

export type { GroupOptions, GroupEntry, ModeConfig, PromptComponent, CustomModePrompts }

// Helper to extract group name regardless of format
export function getGroupName(group: GroupEntry): ToolGroup {
	if (typeof group === "string") {
		return group
	}

	return group[0]
}

// Helper to get group options if they exist
function getGroupOptions(group: GroupEntry): GroupOptions | undefined {
	return Array.isArray(group) ? group[1] : undefined
}

// Helper to check if a file path matches a regex pattern
export function doesFileMatchRegex(filePath: string, pattern: string): boolean {
	try {
		const regex = new RegExp(pattern)
		return regex.test(filePath)
	} catch (error) {
		console.error(`Invalid regex pattern: ${pattern}`, error)
		return false
	}
}

// Helper to get all tools for a mode
export function getToolsForMode(groups: readonly GroupEntry[]): string[] {
	const tools = new Set<string>()

	// Add tools from each group
	groups.forEach((group) => {
		const groupName = getGroupName(group)
		const groupConfig = TOOL_GROUPS[groupName]
		groupConfig.tools.forEach((tool: string) => tools.add(tool))
	})

	// Always add required tools
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))

	return Array.from(tools)
}

// Main modes configuration as an ordered array
export const modes: readonly ModeConfig[] = [
	// {
	// 	slug: "assistant",
	// 	name: "⭐ Assistant",
	// 	roleDefinition: assistantModePrompt.roleDefinition,
	// 	groups: ["read","edit","command", "mcp"], // General tools: read files, browse web, potentially other MCP tools
	// 	customInstructions: assistantModePrompt.customInstructions,
	// },
	// {
	// 	slug: "assistant-pro",
	// 	name: "⭐⭐ Assistant-Pro",
	// 	roleDefinition: assistantProModePrompt.roleDefinition,
	// 	groups: ["read", "edit", "command", "mcp"],
	// 	customInstructions: assistantProModePrompt.customInstructions,
	// }
	// ,
	// {
	// 	slug: "assistant-max",
	// 	name: "⭐⭐⭐ Assistant-Max",
	// 	roleDefinition: assistantMaxModePrompt.roleDefinition,
	// 	groups: ["read", "edit", "command", "mcp"],
	// 	customInstructions: assistantMaxModePrompt.customInstructions,
	// },
	{
		slug: "icemark",
		name: "🤖 Icemark",
		roleDefinition: icemarkModePrompt.roleDefinition,
		groups: ["read", "edit", "browser", "command", "mcp", "prototype"],
		customInstructions: icemarkModePrompt.customInstructions,
	},
	{
		slug: "market",
		name: "📊 Market",
		roleDefinition: marketModePrompt.roleDefinition,
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions: marketModePrompt.customInstructions,
	},
	{
		slug: "prd",
		name: "🎯 PRD",
		roleDefinition: prdModePrompt.roleDefinition,
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions: prdModePrompt.customInstructions,
	},
	{
		slug: "prototype",
		name: "✨ Prototype",
		roleDefinition: prototypeModePrompt.roleDefinition,
		groups: ["read", "edit", "browser", "command", "mcp", "prototype"],
		customInstructions: prototypeModePrompt.customInstructions,
	},
	// {
	// 	slug: "assistant-worker",
	// 	name: "⚙️ Assistant-Worker",
	// 	roleDefinition: assistantWorkerModePrompt.roleDefinition,
	// 	groups: ["read", "edit", "command"],
	// 	customInstructions: assistantWorkerModePrompt.customInstructions,
	// },
	// {
	// 	slug: "resource-manager",
	// 	name: "📚 Resource-Manager",
	// 	roleDefinition: resourceManagerModePrompt.roleDefinition,
	// 	groups: ["read", "edit", "command", "mcp"],
	// 	customInstructions: resourceManagerModePrompt.customInstructions,
	// },

	// {
	// 	slug: "code",
	// 	name: "💻 Code",
	// 	roleDefinition:
	// 		"You are Icemark, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.",
	// 	groups: ["read", "edit", "browser", "command", "mcp"],
	// },
	// {
	// 	slug: "plan",
	// 	name: "🗺️ Plan",
	// 	roleDefinition: planModePrompt.roleDefinition,
	// 	groups: ["read", ["edit", { fileRegex: "\\.md$", description: "Markdown files only" }], "browser", "mcp"],
	// 	customInstructions: planModePrompt.customInstructions,
	// },
	// {
	// 	slug: "Manager",
	// 	name: "🧑‍💼 Manager ",
	// 	roleDefinition: managerModePrompt.roleDefinition,
	// 	groups: [],
	// 	customInstructions: managerModePrompt.customInstructions,
	// },
	// {
	// 	slug: "PM",
	// 	name: "📋 PM",
	// 	roleDefinition: pmModePrompt.roleDefinition,
	// 	groups: ["read", "edit", "browser", "command", "mcp"],
	// 	customInstructions: pmModePrompt.customInstructions,
	// },
] as const

// Export the default mode slug
export const defaultModeSlug = modes[0].slug

// Helper functions
export function getModeBySlug(slug: string, customModes?: ModeConfig[]): ModeConfig | undefined {
	// Check custom modes first
	const customMode = customModes?.find((mode) => mode.slug === slug)
	if (customMode) {
		return customMode
	}
	// Then check built-in modes
	return modes.find((mode) => mode.slug === slug)
}

export function getModeConfig(slug: string, customModes?: ModeConfig[]): ModeConfig {
	const mode = getModeBySlug(slug, customModes)
	if (!mode) {
		throw new Error(`No mode found for slug: ${slug}`)
	}
	return mode
}

// Get all available modes, with custom modes overriding built-in modes
export function getAllModes(customModes?: ModeConfig[]): ModeConfig[] {
	if (!customModes?.length) {
		return [...modes]
	}

	// Start with built-in modes
	const allModes = [...modes]

	// Process custom modes
	customModes.forEach((customMode) => {
		const index = allModes.findIndex((mode) => mode.slug === customMode.slug)
		if (index !== -1) {
			// Override existing mode
			allModes[index] = customMode
		} else {
			// Add new mode
			allModes.push(customMode)
		}
	})

	return allModes
}

// Check if a mode is custom or an override
export function isCustomMode(slug: string, customModes?: ModeConfig[]): boolean {
	return !!customModes?.some((mode) => mode.slug === slug)
}

// Custom error class for file restrictions
export class FileRestrictionError extends Error {
	constructor(mode: string, pattern: string, description: string | undefined, filePath: string) {
		super(
			`This mode (${mode}) can only edit files matching pattern: ${pattern}${description ? ` (${description})` : ""}. Got: ${filePath}`,
		)
		this.name = "FileRestrictionError"
	}
}

export function isToolAllowedForMode(
	tool: string,
	modeSlug: string,
	customModes: ModeConfig[],
	toolRequirements?: Record<string, boolean>,
	toolParams?: Record<string, any>, // All tool parameters
	experiments?: Record<string, boolean>,
): boolean {
	// Always allow these tools
	if (ALWAYS_AVAILABLE_TOOLS.includes(tool as any)) {
		return true
	}
	if (experiments && Object.values(EXPERIMENT_IDS).includes(tool as ExperimentId)) {
		if (!experiments[tool]) {
			return false
		}
	}

	// Check tool requirements if any exist
	if (toolRequirements && typeof toolRequirements === "object") {
		if (tool in toolRequirements && !toolRequirements[tool]) {
			return false
		}
	} else if (toolRequirements === false) {
		// If toolRequirements is a boolean false, all tools are disabled
		return false
	}

	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		return false
	}

	// Check if tool is in any of the mode's groups and respects any group options
	for (const group of mode.groups) {
		const groupName = getGroupName(group)
		const options = getGroupOptions(group)

		const groupConfig = TOOL_GROUPS[groupName]

		// If the tool isn't in this group's tools, continue to next group
		if (!groupConfig.tools.includes(tool)) {
			continue
		}

		// If there are no options, allow the tool
		if (!options) {
			return true
		}

		// For the edit group, check file regex if specified
		if (groupName === "edit" && options.fileRegex) {
			const filePath = toolParams?.path
			if (
				filePath &&
				(toolParams.diff || toolParams.content || toolParams.operations) &&
				!doesFileMatchRegex(filePath, options.fileRegex)
			) {
				throw new FileRestrictionError(mode.name, options.fileRegex, options.description, filePath)
			}
		}

		return true
	}

	return false
}

// Create the mode-specific default prompts
export const defaultPrompts: Readonly<CustomModePrompts> = Object.freeze(
	Object.fromEntries(
		modes.map((mode) => [
			mode.slug,
			{
				roleDefinition: mode.roleDefinition,
				customInstructions: mode.customInstructions,
			},
		]),
	),
)

// Helper function to get all modes with their prompt overrides from extension state
export async function getAllModesWithPrompts(context: vscode.ExtensionContext): Promise<ModeConfig[]> {
	const customModes = (await context.globalState.get<ModeConfig[]>("customModes")) || []
	const customModePrompts = (await context.globalState.get<CustomModePrompts>("customModePrompts")) || {}

	const allModes = getAllModes(customModes)
	return allModes.map((mode) => ({
		...mode,
		roleDefinition: customModePrompts[mode.slug]?.roleDefinition ?? mode.roleDefinition,
		customInstructions: customModePrompts[mode.slug]?.customInstructions ?? mode.customInstructions,
	}))
}

// Helper function to get complete mode details with all overrides
export async function getFullModeDetails(
	modeSlug: string,
	customModes?: ModeConfig[],
	customModePrompts?: CustomModePrompts,
	options?: {
		cwd?: string
		globalCustomInstructions?: string
		language?: string
	},
): Promise<ModeConfig> {
	// First get the base mode config from custom modes or built-in modes
	const baseMode = getModeBySlug(modeSlug, customModes) || modes.find((m) => m.slug === modeSlug) || modes[0]

	// Check for any prompt component overrides
	const promptComponent = customModePrompts?.[modeSlug]

	// Get the base custom instructions
	const baseCustomInstructions = promptComponent?.customInstructions || baseMode.customInstructions || ""

	// If we have cwd, load and combine all custom instructions
	let fullCustomInstructions = baseCustomInstructions
	if (options?.cwd) {
		fullCustomInstructions = await addCustomInstructions(
			baseCustomInstructions,
			options.globalCustomInstructions || "",
			options.cwd,
			modeSlug,
			{ language: options.language },
		)
	}

	// Return mode with any overrides applied
	return {
		...baseMode,
		roleDefinition: promptComponent?.roleDefinition || baseMode.roleDefinition,
		customInstructions: fullCustomInstructions,
	}
}

// Helper function to safely get role definition
export function getRoleDefinition(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.roleDefinition
}

// Helper function to safely get custom instructions
export function getCustomInstructions(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.customInstructions ?? ""
}
