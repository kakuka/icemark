import fs from "fs/promises"
import { PathLike } from "fs"

import { loadRuleFiles, addCustomInstructions } from "../custom-instructions"

// Mock fs/promises
jest.mock("fs/promises")

// Create mock functions
const readFileMock = jest.fn()
const statMock = jest.fn()
const readdirMock = jest.fn()
const readlinkMock = jest.fn()

// Replace fs functions with our mocks
fs.readFile = readFileMock as any
fs.stat = statMock as any
fs.readdir = readdirMock as any
fs.readlink = readlinkMock as any

// Mock path.resolve and path.join to be predictable in tests
jest.mock("path", () => ({
	...jest.requireActual("path"),
	resolve: jest.fn().mockImplementation((...args) => args.join("/")),
	join: jest.fn().mockImplementation((...args) => args.join("/")),
	relative: jest.fn().mockImplementation((from, to) => to),
}))

// Mock process.cwd
const originalCwd = process.cwd
beforeAll(() => {
	process.cwd = jest.fn().mockReturnValue("/fake/cwd")
})

afterAll(() => {
	process.cwd = originalCwd
})

describe("loadRuleFiles", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should read and trim file content", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockResolvedValue("  content with spaces  ")
		const result = await loadRuleFiles("/fake/path")
		expect(readFileMock).toHaveBeenCalled()
		expect(result).toBe("\n# Rules from .roorules:\ncontent with spaces\n")
	})

	it("should handle ENOENT error", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockRejectedValue({ code: "ENOENT" })
		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("")
	})

	it("should handle EISDIR error", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockRejectedValue({ code: "EISDIR" })
		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("")
	})

	it("should throw on unexpected errors", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		const error = new Error("Permission denied") as NodeJS.ErrnoException
		error.code = "EPERM"
		readFileMock.mockRejectedValue(error)

		await expect(async () => {
			await loadRuleFiles("/fake/path")
		}).rejects.toThrow()
	})

	it("should not combine content from multiple rule files when they exist", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().endsWith(".roorules")) {
				return Promise.resolve("roo rules content")
			}
			if (filePath.toString().endsWith(".clinerules")) {
				return Promise.resolve("cline rules content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("\n# Rules from .roorules:\nroo rules content\n")
	})

	it("should handle when no rule files exist", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockRejectedValue({ code: "ENOENT" })

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("")
	})

	it("should skip directories with same name as rule files", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().endsWith(".roorules")) {
				return Promise.reject({ code: "EISDIR" })
			}
			if (filePath.toString().endsWith(".clinerules")) {
				return Promise.reject({ code: "EISDIR" })
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("")
	})

	it("should use .roo/rules/ directory when it exists and has files", async () => {
		// Simulate .roo/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate listing files
		readdirMock.mockResolvedValueOnce([
			{ name: "file1.txt", isFile: () => true, isSymbolicLink: () => false, parentPath: "/fake/path/.roo/rules" },
			{ name: "file2.txt", isFile: () => true, isSymbolicLink: () => false, parentPath: "/fake/path/.roo/rules" },
		] as any)

		statMock.mockImplementation(
			(_path) =>
				({
					isFile: jest.fn().mockReturnValue(true),
				}) as any,
		)

		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString() === "/fake/path/.roo/rules/file1.txt") {
				return Promise.resolve("content of file1")
			}
			if (filePath.toString() === "/fake/path/.roo/rules/file2.txt") {
				return Promise.resolve("content of file2")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toContain("# Rules from /fake/path/.roo/rules/file1.txt:")
		expect(result).toContain("content of file1")
		expect(result).toContain("# Rules from /fake/path/.roo/rules/file2.txt:")
		expect(result).toContain("content of file2")

		// We expect both checks because our new implementation checks the files again for validation
		expect(statMock).toHaveBeenCalledWith("/fake/path/.roo/rules")
		expect(statMock).toHaveBeenCalledWith("/fake/path/.roo/rules/file1.txt")
		expect(statMock).toHaveBeenCalledWith("/fake/path/.roo/rules/file2.txt")
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.roo/rules/file1.txt", "utf-8")
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.roo/rules/file2.txt", "utf-8")
	})

	it("should fall back to .roorules when .roo/rules/ is empty", async () => {
		// Simulate .roo/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate empty directory
		readdirMock.mockResolvedValueOnce([])

		// Simulate .roorules exists
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().endsWith(".roorules")) {
				return Promise.resolve("roo rules content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("\n# Rules from .roorules:\nroo rules content\n")
	})

	it("should handle errors when reading directory", async () => {
		// Simulate .roo/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate error reading directory
		readdirMock.mockRejectedValueOnce(new Error("Failed to read directory"))

		// Simulate .roorules exists
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().endsWith(".roorules")) {
				return Promise.resolve("roo rules content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("\n# Rules from .roorules:\nroo rules content\n")
	})

	it("should read files from nested subdirectories in .roo/rules/", async () => {
		// Simulate .roo/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate listing files including subdirectories
		readdirMock.mockResolvedValueOnce([
			{
				name: "subdir",
				isFile: () => false,
				isSymbolicLink: () => false,
				isDirectory: () => true,
				parentPath: "/fake/path/.roo/rules",
			},
			{
				name: "root.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				isDirectory: () => false,
				parentPath: "/fake/path/.roo/rules",
			},
			{
				name: "nested1.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				isDirectory: () => false,
				parentPath: "/fake/path/.roo/rules/subdir",
			},
			{
				name: "nested2.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				isDirectory: () => false,
				parentPath: "/fake/path/.roo/rules/subdir/subdir2",
			},
		] as any)

		statMock.mockImplementation((path: string) => {
			if (path.endsWith("txt")) {
				return Promise.resolve({
					isFile: jest.fn().mockReturnValue(true),
					isDirectory: jest.fn().mockReturnValue(false),
				} as any)
			}
			return Promise.resolve({
				isFile: jest.fn().mockReturnValue(false),
				isDirectory: jest.fn().mockReturnValue(true),
			} as any)
		})

		readFileMock.mockImplementation((filePath: PathLike) => {
			const path = filePath.toString()
			if (path === "/fake/path/.roo/rules/root.txt") {
				return Promise.resolve("root file content")
			}
			if (path === "/fake/path/.roo/rules/subdir/nested1.txt") {
				return Promise.resolve("nested file 1 content")
			}
			if (path === "/fake/path/.roo/rules/subdir/subdir2/nested2.txt") {
				return Promise.resolve("nested file 2 content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")

		// Check root file content
		expect(result).toContain("# Rules from /fake/path/.roo/rules/root.txt:")
		expect(result).toContain("root file content")

		// Check nested files content
		expect(result).toContain("# Rules from /fake/path/.roo/rules/subdir/nested1.txt:")
		expect(result).toContain("nested file 1 content")
		expect(result).toContain("# Rules from /fake/path/.roo/rules/subdir/subdir2/nested2.txt:")
		expect(result).toContain("nested file 2 content")

		// Verify correct paths were checked
		expect(statMock).toHaveBeenCalledWith("/fake/path/.roo/rules/root.txt")
		expect(statMock).toHaveBeenCalledWith("/fake/path/.roo/rules/subdir/nested1.txt")
		expect(statMock).toHaveBeenCalledWith("/fake/path/.roo/rules/subdir/subdir2/nested2.txt")

		// Verify files were read with correct paths
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.roo/rules/root.txt", "utf-8")
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.roo/rules/subdir/nested1.txt", "utf-8")
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.roo/rules/subdir/subdir2/nested2.txt", "utf-8")
	})
})

describe("addCustomInstructions", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should combine all instruction types when provided", async () => {
		// Simulate no .roo/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockResolvedValue("mode specific rules")

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
			{ language: "zh-CN" },
		)

		expect(result).toContain("Language Preference:")
		expect(result).toContain("中文") // Check for language name
		expect(result).toContain("(zh-CN)") // Check for language code in parentheses
		expect(result).toContain("Global Instructions:\nglobal instructions")
		expect(result).toContain("Mode-specific Instructions:\nmode instructions")
		expect(result).toContain("Rules from .roorules-test-mode:\nmode specific rules")
	})

	it("should return empty string when no instructions provided", async () => {
		// Simulate no .roo/rules directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockRejectedValue({ code: "ENOENT" })

		const result = await addCustomInstructions("", "", "/fake/path", "", {})
		expect(result).toBe("")
	})

	it("should handle missing mode-specific rules file", async () => {
		// Simulate no .roo/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockRejectedValue({ code: "ENOENT" })

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain("Global Instructions:")
		expect(result).toContain("Mode-specific Instructions:")
		expect(result).not.toContain("Rules from .clinerules-test-mode")
	})

	it("should handle unknown language codes properly", async () => {
		// Simulate no .roo/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockRejectedValue({ code: "ENOENT" })

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
			{ language: "xyz" }, // Unknown language code
		)

		expect(result).toContain("Language Preference:")
		expect(result).toContain('"xyz" (xyz) language') // For unknown codes, the code is used as the name too
		expect(result).toContain("Global Instructions:\nglobal instructions")
	})

	it("should throw on unexpected errors", async () => {
		// Simulate no .roo/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		const error = new Error("Permission denied") as NodeJS.ErrnoException
		error.code = "EPERM"
		readFileMock.mockRejectedValue(error)

		await expect(async () => {
			await addCustomInstructions("", "", "/fake/path", "test-mode")
		}).rejects.toThrow()
	})

	it("should skip mode-specific rule files that are directories", async () => {
		// Simulate no .roo/rules-test-mode directory
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().includes(".clinerules-test-mode")) {
				return Promise.reject({ code: "EISDIR" })
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain("Global Instructions:\nglobal instructions")
		expect(result).toContain("Mode-specific Instructions:\nmode instructions")
		expect(result).not.toContain("Rules from .clinerules-test-mode")
	})

	it("should use .roo/rules-test-mode/ directory when it exists and has files", async () => {
		// Simulate .roo/rules-test-mode directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate listing files
		readdirMock.mockResolvedValueOnce([
			{
				name: "rule1.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				parentPath: "/fake/path/.roo/rules-test-mode",
			},
			{
				name: "rule2.txt",
				isFile: () => true,
				isSymbolicLink: () => false,
				parentPath: "/fake/path/.roo/rules-test-mode",
			},
		] as any)

		statMock.mockImplementation(
			(_path) =>
				({
					isFile: jest.fn().mockReturnValue(true),
				}) as any,
		)

		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString() === "/fake/path/.roo/rules-test-mode/rule1.txt") {
				return Promise.resolve("mode specific rule 1")
			}
			if (filePath.toString() === "/fake/path/.roo/rules-test-mode/rule2.txt") {
				return Promise.resolve("mode specific rule 2")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
			{ language: "es" },
		)

		expect(result).toContain("# Rules from /fake/path/.roo/rules-test-mode")
		expect(result).toContain("# Rules from /fake/path/.roo/rules-test-mode/rule1.txt:")
		expect(result).toContain("mode specific rule 1")
		expect(result).toContain("# Rules from /fake/path/.roo/rules-test-mode/rule2.txt:")
		expect(result).toContain("mode specific rule 2")

		expect(statMock).toHaveBeenCalledWith("/fake/path/.roo/rules-test-mode")
		expect(statMock).toHaveBeenCalledWith("/fake/path/.roo/rules-test-mode/rule1.txt")
		expect(statMock).toHaveBeenCalledWith("/fake/path/.roo/rules-test-mode/rule2.txt")
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.roo/rules-test-mode/rule1.txt", "utf-8")
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.roo/rules-test-mode/rule2.txt", "utf-8")
	})

	it("should fall back to .roorules-test-mode when .roo/rules-test-mode/ does not exist", async () => {
		// Simulate .roo/rules-test-mode directory does not exist
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		// Simulate .roorules-test-mode exists
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().includes(".roorules-test-mode")) {
				return Promise.resolve("mode specific rules from file")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain("Rules from .roorules-test-mode:\nmode specific rules from file")
	})

	it("should fall back to .clinerules-test-mode when .roo/rules-test-mode/ and .roorules-test-mode do not exist", async () => {
		// Simulate .roo/rules-test-mode directory does not exist
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		// Simulate file reading
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString().includes(".roorules-test-mode")) {
				return Promise.reject({ code: "ENOENT" })
			}
			if (filePath.toString().includes(".clinerules-test-mode")) {
				return Promise.resolve("mode specific rules from cline file")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain("Rules from .clinerules-test-mode:\nmode specific rules from cline file")
	})

	it("should correctly format content from directories when using .roo/rules-test-mode/", async () => {
		// Need to reset mockImplementation first to avoid interference from previous tests
		statMock.mockReset()
		readFileMock.mockReset()

		// Simulate .roo/rules-test-mode directory exists
		statMock.mockImplementationOnce(() =>
			Promise.resolve({
				isDirectory: jest.fn().mockReturnValue(true),
			} as any),
		)

		// Simulate directory has files
		readdirMock.mockResolvedValueOnce([
			{ name: "rule1.txt", isFile: () => true, parentPath: "/fake/path/.roo/rules-test-mode" },
		] as any)
		readFileMock.mockReset()

		// Set up stat mock for checking files
		let statCallCount = 0
		statMock.mockImplementation((filePath) => {
			statCallCount++
			if (filePath === "/fake/path/.roo/rules-test-mode/rule1.txt") {
				return Promise.resolve({
					isFile: jest.fn().mockReturnValue(true),
					isDirectory: jest.fn().mockReturnValue(false),
				} as any)
			}
			return Promise.resolve({
				isFile: jest.fn().mockReturnValue(false),
				isDirectory: jest.fn().mockReturnValue(false),
			} as any)
		})

		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString() === "/fake/path/.roo/rules-test-mode/rule1.txt") {
				return Promise.resolve("mode specific rule content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/fake/path",
			"test-mode",
		)

		expect(result).toContain("# Rules from /fake/path/.roo/rules-test-mode")
		expect(result).toContain("# Rules from /fake/path/.roo/rules-test-mode/rule1.txt:")
		expect(result).toContain("mode specific rule content")

		expect(statCallCount).toBeGreaterThan(0)
	})
})

// Test directory existence checks through loadRuleFiles
describe("Directory existence checks", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should detect when directory exists", async () => {
		// Mock the stats to indicate the directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate empty directory to test that stats is called
		readdirMock.mockResolvedValueOnce([])

		// For loadRuleFiles to return something for testing
		readFileMock.mockResolvedValueOnce("fallback content")

		await loadRuleFiles("/fake/path")

		// Verify stat was called to check directory existence
		expect(statMock).toHaveBeenCalledWith("/fake/path/.roo/rules")
	})

	it("should handle when directory does not exist", async () => {
		// Mock the stats to indicate the directory doesn't exist
		statMock.mockRejectedValueOnce({ code: "ENOENT" })

		// Mock file read to verify fallback
		readFileMock.mockResolvedValueOnce("fallback content")

		const result = await loadRuleFiles("/fake/path")

		// Verify it fell back to reading rule files directly
		expect(result).toBe("\n# Rules from .roorules:\nfallback content\n")
	})
})

// Indirectly test readTextFilesFromDirectory and formatDirectoryContent through loadRuleFiles
describe("Rules directory reading", () => {
	it("should follow symbolic links in the rules directory", async () => {
		// Simulate .roo/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate listing files including a symlink
		readdirMock
			.mockResolvedValueOnce([
				{
					name: "regular.txt",
					isFile: () => true,
					isSymbolicLink: () => false,
					parentPath: "/fake/path/.roo/rules",
				},
				{
					name: "link.txt",
					isFile: () => false,
					isSymbolicLink: () => true,
					parentPath: "/fake/path/.roo/rules",
				},
				{
					name: "link_dir",
					isFile: () => false,
					isSymbolicLink: () => true,
					parentPath: "/fake/path/.roo/rules",
				},
				{
					name: "nested_link.txt",
					isFile: () => false,
					isSymbolicLink: () => true,
					parentPath: "/fake/path/.roo/rules",
				},
			] as any)
			.mockResolvedValueOnce([
				{ name: "subdir_link.txt", isFile: () => true, parentPath: "/fake/path/.roo/rules/symlink-target-dir" },
			] as any)

		// Simulate readlink response
		readlinkMock
			.mockResolvedValueOnce("../symlink-target.txt")
			.mockResolvedValueOnce("../symlink-target-dir")
			.mockResolvedValueOnce("../nested-symlink")
			.mockResolvedValueOnce("nested-symlink-target.txt")

		// Reset and set up the stat mock with more granular control
		statMock.mockReset()
		statMock.mockImplementation((path: string) => {
			// For directory check
			if (path === "/fake/path/.roo/rules" || path.endsWith("dir")) {
				return Promise.resolve({
					isDirectory: jest.fn().mockReturnValue(true),
					isFile: jest.fn().mockReturnValue(false),
				} as any)
			}

			// For symlink check
			if (path.endsWith("symlink")) {
				return Promise.resolve({
					isDirectory: jest.fn().mockReturnValue(false),
					isFile: jest.fn().mockReturnValue(false),
					isSymbolicLink: jest.fn().mockReturnValue(true),
				} as any)
			}

			// For all files
			return Promise.resolve({
				isFile: jest.fn().mockReturnValue(true),
				isDirectory: jest.fn().mockReturnValue(false),
			} as any)
		})

		// Simulate file content reading
		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString() === "/fake/path/.roo/rules/regular.txt") {
				return Promise.resolve("regular file content")
			}
			if (filePath.toString() === "/fake/path/.roo/rules/../symlink-target.txt") {
				return Promise.resolve("symlink target content")
			}
			if (filePath.toString() === "/fake/path/.roo/rules/symlink-target-dir/subdir_link.txt") {
				return Promise.resolve("regular file content under symlink target dir")
			}
			if (filePath.toString() === "/fake/path/.roo/rules/../nested-symlink-target.txt") {
				return Promise.resolve("nested symlink target content")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")

		// Verify both regular file and symlink target content are included
		expect(result).toContain("# Rules from /fake/path/.roo/rules/regular.txt:")
		expect(result).toContain("regular file content")
		expect(result).toContain("# Rules from /fake/path/.roo/rules/../symlink-target.txt:")
		expect(result).toContain("symlink target content")
		expect(result).toContain("# Rules from /fake/path/.roo/rules/symlink-target-dir/subdir_link.txt:")
		expect(result).toContain("regular file content under symlink target dir")
		expect(result).toContain("# Rules from /fake/path/.roo/rules/../nested-symlink-target.txt:")
		expect(result).toContain("nested symlink target content")

		// Verify readlink was called with the symlink path
		expect(readlinkMock).toHaveBeenCalledWith("/fake/path/.roo/rules/link.txt")
		expect(readlinkMock).toHaveBeenCalledWith("/fake/path/.roo/rules/link_dir")

		// Verify both files were read
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.roo/rules/regular.txt", "utf-8")
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.roo/rules/../symlink-target.txt", "utf-8")
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.roo/rules/symlink-target-dir/subdir_link.txt", "utf-8")
		expect(readFileMock).toHaveBeenCalledWith("/fake/path/.roo/rules/../nested-symlink-target.txt", "utf-8")
	})
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should correctly format multiple files from directory", async () => {
		// Simulate .roo/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate listing files
		readdirMock.mockResolvedValueOnce([
			{ name: "file1.txt", isFile: () => true, parentPath: "/fake/path/.roo/rules" },
			{ name: "file2.txt", isFile: () => true, parentPath: "/fake/path/.roo/rules" },
			{ name: "file3.txt", isFile: () => true, parentPath: "/fake/path/.roo/rules" },
		] as any)

		statMock.mockImplementation((path) => {
			expect([
				"/fake/path/.roo/rules/file1.txt",
				"/fake/path/.roo/rules/file2.txt",
				"/fake/path/.roo/rules/file3.txt",
			]).toContain(path)

			return Promise.resolve({
				isFile: jest.fn().mockReturnValue(true),
			}) as any
		})

		readFileMock.mockImplementation((filePath: PathLike) => {
			if (filePath.toString() === "/fake/path/.roo/rules/file1.txt") {
				return Promise.resolve("content of file1")
			}
			if (filePath.toString() === "/fake/path/.roo/rules/file2.txt") {
				return Promise.resolve("content of file2")
			}
			if (filePath.toString() === "/fake/path/.roo/rules/file3.txt") {
				return Promise.resolve("content of file3")
			}
			return Promise.reject({ code: "ENOENT" })
		})

		const result = await loadRuleFiles("/fake/path")

		expect(result).toContain("# Rules from /fake/path/.roo/rules/file1.txt:")
		expect(result).toContain("content of file1")
		expect(result).toContain("# Rules from /fake/path/.roo/rules/file2.txt:")
		expect(result).toContain("content of file2")
		expect(result).toContain("# Rules from /fake/path/.roo/rules/file3.txt:")
		expect(result).toContain("content of file3")
	})

	it("should handle empty file list gracefully", async () => {
		// Simulate .roo/rules directory exists
		statMock.mockResolvedValueOnce({
			isDirectory: jest.fn().mockReturnValue(true),
		} as any)

		// Simulate empty directory
		readdirMock.mockResolvedValueOnce([])

		readFileMock.mockResolvedValueOnce("fallback content")

		const result = await loadRuleFiles("/fake/path")
		expect(result).toBe("\n# Rules from .roorules:\nfallback content\n")
	})
})
