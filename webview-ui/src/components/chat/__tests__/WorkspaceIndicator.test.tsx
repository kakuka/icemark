import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import WorkspaceIndicator from "../WorkspaceIndicator"

// Mock dependencies
jest.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: jest.fn(),
}))

jest.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

jest.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"chat:workspace.notSet": "Workspace Not Set",
				"chat:workspace.isSet": "Workspace Set",
				"chat:workspace.fileSavePrefix": "Files will be saved to: ",
				"chat:workspace.setButton": "Set",
				"chat:workspace.switchButton": "Switch",
				"chat:workspace.helpButton": "Help",
				"chat:workspace.clickToOpen": "Click to open in file manager",
				"chat:workspace.noPath": "No path set",
			}
			return translations[key] || key
		},
	}),
}))

const mockUseExtensionState = useExtensionState as jest.MockedFunction<typeof useExtensionState>
const mockPostMessage = vscode.postMessage as jest.MockedFunction<typeof vscode.postMessage>

describe("WorkspaceIndicator", () => {
	const mockOnToggle = jest.fn()
	const defaultProps = {
		expanded: true,
		onToggle: mockOnToggle,
	}

	beforeEach(() => {
		jest.clearAllMocks()
		mockOnToggle.mockClear()
	})

	it("should render workspace not set state", () => {
		mockUseExtensionState.mockReturnValue({
			cwd: "",
		} as any)

		render(<WorkspaceIndicator {...defaultProps} />)

		expect(screen.getByText("Workspace Not Set")).toBeInTheDocument()
		expect(screen.getByText("Set")).toBeInTheDocument()
		expect(screen.getByText("Help")).toBeInTheDocument()
		expect(screen.getByText("Files will be saved to: No path set")).toBeInTheDocument()
	})

	it("should render workspace set state", () => {
		mockUseExtensionState.mockReturnValue({
			cwd: "/Users/test/project",
		} as any)

		render(<WorkspaceIndicator {...defaultProps} />)

		expect(screen.getByText("Workspace Set")).toBeInTheDocument()
		expect(screen.getByText("Switch")).toBeInTheDocument()
		expect(screen.getByText("Help")).toBeInTheDocument()
		expect(screen.getByText("/Users/test/project")).toBeInTheDocument()
	})

	it("should truncate long paths", () => {
		const longPath = "/very/long/path/to/some/deeply/nested/directory/structure/project"
		mockUseExtensionState.mockReturnValue({
			cwd: longPath,
		} as any)

		render(<WorkspaceIndicator {...defaultProps} />)

		// Should show truncated path
		expect(screen.getByText("/very/.../structure/project")).toBeInTheDocument()
	})

	it("should handle set/switch workspace button click", () => {
		mockUseExtensionState.mockReturnValue({
			cwd: "/Users/test/project",
		} as any)

		render(<WorkspaceIndicator {...defaultProps} />)

		fireEvent.click(screen.getByText("Switch"))

		expect(mockPostMessage).toHaveBeenCalledWith({ type: "openFolder" })
	})

	it("should handle help button click", () => {
		mockUseExtensionState.mockReturnValue({
			cwd: "",
		} as any)

		render(<WorkspaceIndicator {...defaultProps} />)

		fireEvent.click(screen.getByText("Help"))

		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "openExternal",
			text: "https://code.visualstudio.com/docs/editing/workspaces/workspaces",
		})
	})

	it("should handle path click", () => {
		const testPath = "/Users/test/project"
		mockUseExtensionState.mockReturnValue({
			cwd: testPath,
		} as any)

		render(<WorkspaceIndicator {...defaultProps} />)

		fireEvent.click(screen.getByText(testPath))

		expect(mockPostMessage).toHaveBeenCalledWith({
			type: "revealInExplorer",
			text: testPath,
		})
	})

	it("should not handle path click when no path is set", () => {
		mockUseExtensionState.mockReturnValue({
			cwd: "",
		} as any)

		render(<WorkspaceIndicator {...defaultProps} />)

		fireEvent.click(screen.getByText("No path set"))

		expect(mockPostMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({
				type: "revealInExplorer",
			}),
		)
	})

	it("should handle toggle click", () => {
		mockUseExtensionState.mockReturnValue({ cwd: "" } as any)
		render(<WorkspaceIndicator {...defaultProps} expanded={false} />)

		const header = screen.getByTitle("chat:workspace.expand")
		fireEvent.click(header)

		expect(mockOnToggle).toHaveBeenCalledWith(true)
	})
})
