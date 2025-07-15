#!/usr/bin/env node

const { execSync } = require("child_process")
const readline = require("readline")

// 颜色输出
const colors = {
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	reset: "\x1b[0m",
}

const log = {
	info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
	success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
	warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
	error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
	title: (msg) => console.log(`\n${colors.cyan}🚀 ${msg}${colors.reset}\n`),
}

// 执行Git命令
function runGitCommand(command, silent = false, allowFailure = false) {
	try {
		const result = execSync(command, {
			encoding: "utf8",
			stdio: silent ? "pipe" : "inherit",
		})
		return result ? result.trim() : ""
	} catch (error) {
		if (allowFailure) {
			throw error // 允许失败的命令，抛出异常让调用者处理
		}
		log.error(`命令执行失败: ${command}`)
		log.error(error.message)
		process.exit(1)
	}
}

// 获取当前分支
function getCurrentBranch() {
	return runGitCommand("git rev-parse --abbrev-ref HEAD", true)
}

// 检查分支是否存在
function branchExists(branchName, remote = false) {
	try {
		const command = remote
			? `git ls-remote --heads origin ${branchName}`
			: `git show-ref --verify --quiet refs/heads/${branchName}`
		runGitCommand(command, true, true) // 允许失败
		return true
	} catch {
		return false
	}
}

// 获取用户输入
function askQuestion(question) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})

	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close()
			resolve(answer.trim())
		})
	})
}

// 1. 创建新分支
async function createNewBranch(args) {
	log.title("创建新分支")

	const [type, issueNumber, ...descParts] = args

	if (!type) {
		const validTypes = ["feat", "fix", "docs", "refactor", "chore", "release"]
		log.error(`请指定分支类型: ${validTypes.join(", ")}`)
		log.info("用法: npm run icemark-action new-branch <type> <issue-number> <description>")
		log.info("示例: npm run icemark-action new-branch feat 123 login-form")
		log.info("示例: npm run icemark-action new-branch release v1.2.0")
		return
	}

	let branchName

	if (type === "release") {
		const version = issueNumber
		if (!version) {
			log.error("Release分支需要指定版本号")
			log.info("示例: npm run icemark-action new-branch release v1.2.0")
			return
		}
		branchName = `release/${version}`
	} else {
		if (!issueNumber || !descParts.length) {
			log.error("开发分支需要指定issue号和描述")
			log.info("示例: npm run icemark-action new-branch feat 123 login-form")
			return
		}
		const description = descParts.join("-")
		branchName = `${type}/${issueNumber}-${description}`
	}

	// 检查分支是否已存在
	if (branchExists(branchName)) {
		log.error(`分支 ${branchName} 已存在`)
		return
	}

	// 确保在main分支
	const currentBranch = getCurrentBranch()
	if (currentBranch !== "main") {
		log.info("切换到main分支...")
		runGitCommand("git checkout main")
	}

	// 拉取最新代码
	log.info("拉取最新main分支代码...")
	runGitCommand("git pull origin main")

	// 创建新分支
	log.info(`创建分支: ${branchName}`)
	runGitCommand(`git checkout -b ${branchName}`)

	log.success(`分支 ${branchName} 创建成功！`)
	log.info(`当前分支: ${branchName}`)
}

// 2. 清理开发分支
async function clearDevBranch(args) {
	log.title("清理开发分支")

	let branchName = args[0]

	if (!branchName) {
		// 如果没有指定分支名，使用当前分支
		branchName = getCurrentBranch()

		if (branchName === "main") {
			log.error("不能删除main分支")
			return
		}

		if (branchName.startsWith("release/")) {
			log.error("请使用 clear-release-branch 命令删除release分支")
			return
		}

		const confirm = await askQuestion(`确认删除当前分支 ${branchName} 吗？(y/N): `)
		if (confirm.toLowerCase() !== "y") {
			log.info("操作取消")
			return
		}
	}

	// 检查是否为开发分支
	const isDevBranch = /^(feat|fix|docs|refactor|chore)\//.test(branchName)
	if (!isDevBranch) {
		log.error("只能删除开发分支 (feat/*, fix/*, docs/*, refactor/*, chore/*)")
		return
	}

	const currentBranch = getCurrentBranch()

	// 先删除远程分支（必须在切换到main之前，避免husky阻止main分支push操作）
	if (branchExists(branchName, true)) {
		log.info(`删除远程分支: ${branchName}`)
		runGitCommand(`git push origin --delete ${branchName}`)
		log.success("远程分支删除成功")
	} else {
		log.warning("远程分支不存在，跳过删除")
	}

	// 如果当前在要删除的分支上，切换到main分支
	if (currentBranch === branchName) {
		log.info("切换到main分支...")
		runGitCommand("git checkout main")
	}

	// 拉取最新main分支
	log.info("拉取最新main分支代码...")
	runGitCommand("git pull origin main")

	// 删除本地分支
	if (branchExists(branchName)) {
		log.info(`删除本地分支: ${branchName}`)
		runGitCommand(`git branch -d ${branchName}`)
		log.success("本地分支删除成功")
	} else {
		log.warning("本地分支不存在，跳过删除")
	}

	log.success(`分支 ${branchName} 清理完成！`)
}

// 3. 清理release分支（仅本地）
async function clearReleaseBranch(args) {
	log.title("清理Release分支（仅本地）")

	let branchName = args[0]

	if (!branchName) {
		// 如果没有指定分支名，使用当前分支
		branchName = getCurrentBranch()

		if (!branchName.startsWith("release/")) {
			log.error("请指定release分支名或在release分支上执行")
			log.info("示例: npm run icemark-action clear-release-branch release/v1.2.0")
			return
		}

		const confirm = await askQuestion(`确认删除当前release分支 ${branchName} 吗？(y/N): `)
		if (confirm.toLowerCase() !== "y") {
			log.info("操作取消")
			return
		}
	}

	// 检查是否为release分支
	if (!branchName.startsWith("release/")) {
		log.error("只能删除release分支 (release/*)")
		return
	}

	// 如果当前在要删除的分支上，先切换到main
	const currentBranch = getCurrentBranch()
	if (currentBranch === branchName) {
		log.info("切换到main分支...")
		runGitCommand("git checkout main")

		// 拉取最新main分支
		log.info("拉取最新main分支代码...")
		runGitCommand("git pull origin main")
	}

	// 删除本地分支
	if (branchExists(branchName)) {
		log.info(`删除本地release分支: ${branchName}`)
		runGitCommand(`git branch -d ${branchName}`)
		log.success("本地release分支删除成功")
	} else {
		log.warning("本地release分支不存在")
	}

	log.success(`Release分支 ${branchName} 清理完成！`)
	log.info("注意: 远程release分支保留作为备份")
}

// 4. 发布（打标签）
async function release(args) {
	log.title("发布操作")

	const version = args[0]

	if (!version) {
		log.error("请指定版本号")
		log.info("用法: npm run icemark-action release <version>")
		log.info("示例: npm run icemark-action release v1.2.0")
		return
	}

	const currentBranch = getCurrentBranch()

	// 检查是否在release分支
	if (!currentBranch.startsWith("release/")) {
		log.error("请在release分支上执行发布操作")
		log.info(`当前分支: ${currentBranch}`)
		return
	}

	// 检查标签是否已存在
	try {
		runGitCommand(`git rev-parse ${version}`, true, true) // 允许失败
		log.error(`标签 ${version} 已存在`)
		return
	} catch {
		// 标签不存在，继续
	}

	// 确认发布
	log.info(`当前分支: ${currentBranch}`)
	log.info(`准备发布版本: ${version}`)
	const confirm = await askQuestion("确认发布吗？(y/N): ")
	if (confirm.toLowerCase() !== "y") {
		log.info("发布取消")
		return
	}

	// 创建标签
	log.info(`创建标签: ${version}`)
	runGitCommand(`git tag ${version}`)
	log.success("标签创建成功")

	// 推送标签
	log.info("推送标签到远程...")
	runGitCommand(`git push origin ${version}`)
	log.success("标签推送成功")

	log.success(`版本 ${version} 发布完成！`)
	log.info("下一步: 创建PR将release分支合并到main分支")
}

// 显示帮助信息
function showHelp() {
	console.log(`
${colors.cyan}Icemark Action - Git工作流自动化工具${colors.reset}

${colors.yellow}用法:${colors.reset}
  npm run icemark-action <command> [args...]

${colors.yellow}命令:${colors.reset}
  ${colors.green}new-branch${colors.reset} <type> <issue-number> <description>
    创建新的开发分支
    示例: npm run icemark-action new-branch feat 123 login-form
    
  ${colors.green}new-branch${colors.reset} release <version>
    创建新的release分支
    示例: npm run icemark-action new-branch release v1.2.0

  ${colors.green}clear-dev-branch${colors.reset} [branch-name]
    删除开发分支（远程+本地），不指定分支名则删除当前分支
    示例: npm run icemark-action clear-dev-branch feat/123-login-form

  ${colors.green}clear-release-branch${colors.reset} [branch-name]
    删除release分支（仅本地），不指定分支名则删除当前分支
    示例: npm run icemark-action clear-release-branch release/v1.2.0

  ${colors.green}release${colors.reset} <version>
    在当前release分支创建标签并推送
    示例: npm run icemark-action release v1.2.0

${colors.yellow}分支类型:${colors.reset}
  feat, fix, docs, refactor, chore, release
`)
}

// 主函数
async function main() {
	const [command, ...args] = process.argv.slice(2)

	if (!command || command === "help" || command === "--help" || command === "-h") {
		showHelp()
		return
	}

	try {
		switch (command) {
			case "new-branch":
				await createNewBranch(args)
				break
			case "clear-dev-branch":
				await clearDevBranch(args)
				break
			case "clear-release-branch":
				await clearReleaseBranch(args)
				break
			case "release":
				await release(args)
				break
			default:
				log.error(`未知命令: ${command}`)
				showHelp()
		}
	} catch (error) {
		log.error(`执行失败: ${error.message}`)
		process.exit(1)
	}
}

if (require.main === module) {
	main()
}

module.exports = {
	createNewBranch,
	clearDevBranch,
	clearReleaseBranch,
	release,
}
