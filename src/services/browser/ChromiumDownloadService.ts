import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { launch } from "puppeteer-core"
// @ts-ignore
import PCR from "puppeteer-chromium-resolver"
import { fileExistsAtPath } from "../../utils/fs"

// 使用require导入adm-zip以避免类型问题
const AdmZip = require('adm-zip')

export interface PCRStats {
	puppeteer: { launch: typeof launch }
	executablePath: string
}

interface PlatformInfo {
	platform: string
	archiveName: string
	executableName: string
	versions: string[]
}

export class ChromiumDownloadService {
	private context: vscode.ExtensionContext
	private static downloading: boolean = false

	constructor(context: vscode.ExtensionContext) {
		this.context = context
	}

	private async testDefaultSourceAvailability(): Promise<boolean> {
		try {
			console.log('ChromiumDownloadService: 测试默认源的可用性...')
			// 使用一个简单的HEAD请求测试Google源的连通性
			const testUrl = 'https://storage.googleapis.com/chromium-browser-snapshots/'
			const response = await fetch(testUrl, { 
				method: 'HEAD',
				signal: AbortSignal.timeout(3000) // 3秒超时
			})
			
			const available = response.ok
			console.log(`ChromiumDownloadService: 默认源可用性: ${available ? '✅ 可用' : '❌ 不可用'}`)
			return available
		} catch (error) {
			console.log(`ChromiumDownloadService: 默认源不可用: ${error.message}`)
			return false
		}
	}

	private getPlatformInfo(): PlatformInfo {
		const platform = process.platform
		const arch = process.arch
		
		if (platform === 'win32') {
			if (arch === 'x64') {
				return { 
					platform: 'Win_x64', 
					archiveName: 'chrome-win.zip',
					executableName: 'chrome-win/chrome.exe',
					versions: ['1467289', '1472194']
				}
			} else {
				return { 
					platform: 'Win', 
					archiveName: 'chrome-win.zip',
					executableName: 'chrome-win/chrome.exe',
					versions: ['1399978', '1472975', '1467292']
				}
			}
		} else if (platform === 'darwin') {
			if (arch === 'arm64') {
				return { 
					platform: 'Mac_Arm', 
					archiveName: 'chrome-mac.zip',
					executableName: 'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
					versions: ['1476710', '1476888', '1399989']
				}
			} else {
				return { 
					platform: 'Mac', 
					archiveName: 'chrome-mac.zip',
					executableName: 'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
					versions: ['1440100', '1440037', '1399989']
				}
			}
		} else if (platform === 'linux') {
			return { 
				platform: 'Linux_x64', 
				archiveName: 'chrome-linux.zip',
				executableName: 'chrome-linux/chrome',
				versions: ['1477095', '1477096', '1419909']
			}
		} else {
			// 默认使用Linux
			console.log(`ChromiumDownloadService: 未知平台 ${platform}，使用Linux作为默认`)
			return { 
				platform: 'Linux_x64', 
				archiveName: 'chrome-linux.zip',
				executableName: 'chrome-linux/chrome',
				versions: ['1477095', '1477096', '1419909']
			}
		}
	}

	private async downloadAndExtractChrome(downloadUrl: string, targetDir: string, version: string): Promise<string> {
		const platformInfo = this.getPlatformInfo()
		
		// 创建版本特定的目录结构，模拟PCR的结构
		const versionDir = path.join(targetDir, '.chromium-browser-snapshots', platformInfo.platform, version)
		const archivePath = path.join(versionDir, platformInfo.archiveName)
		
		// 检查是否已经存在（直接使用包含文件夹的路径）
		const executablePath = path.join(versionDir, platformInfo.executableName)
		if (await fileExistsAtPath(executablePath)) {
			console.log(`ChromiumDownloadService: Chrome已存在: ${executablePath}`)
			return executablePath
		}
		
		console.log(`ChromiumDownloadService: 开始下载Chrome从: ${downloadUrl}`)
		console.log(`ChromiumDownloadService: 目标目录: ${versionDir}`)
		console.log(`ChromiumDownloadService: 期望的可执行文件路径: ${executablePath}`)
		
		// 创建目录
		await fs.mkdir(versionDir, { recursive: true })
		
		// 下载文件
		console.log(`ChromiumDownloadService: 正在下载 ${platformInfo.archiveName}...`)
		const response = await fetch(downloadUrl, {
			signal: AbortSignal.timeout(300000) // 5分钟超时
		})
		
		if (!response.ok) {
			throw new Error(`下载失败: ${response.status} ${response.statusText}`)
		}
		
		const contentLength = response.headers.get('content-length')
		if (contentLength) {
			console.log(`ChromiumDownloadService: 文件大小: ${Math.round(parseInt(contentLength) / 1024 / 1024)}MB`)
		}
		
		const buffer = await response.arrayBuffer()
		await fs.writeFile(archivePath, Buffer.from(buffer))
		
		console.log(`ChromiumDownloadService: 下载完成，文件保存到: ${archivePath}`)
		console.log(`ChromiumDownloadService: 开始解压缩...`)
		
		// 解压缩文件到版本目录
		await this.extractArchive(archivePath, versionDir)
		
		// 删除压缩包以节省空间
		await fs.unlink(archivePath).catch((error) => {
			console.log(`ChromiumDownloadService: 清理压缩包失败: ${error.message}`)
		})
		
		// 验证可执行文件存在
		if (!(await fileExistsAtPath(executablePath))) {
			// 列出解压后的内容以便调试
			try {
				const extractedFiles = await fs.readdir(versionDir, { recursive: true })
				console.log(`ChromiumDownloadService: 解压后的文件列表:`, extractedFiles.slice(0, 20)) // 只显示前20个文件
			} catch (error) {
				console.log(`ChromiumDownloadService: 无法列出解压后的文件: ${error.message}`)
			}
			throw new Error(`解压缩后未找到可执行文件: ${executablePath}`)
		}
		
		// 在Linux/Mac上设置执行权限
		if (process.platform !== 'win32') {
			try {
				await fs.chmod(executablePath, 0o755)
				console.log(`ChromiumDownloadService: 已设置执行权限: ${executablePath}`)
			} catch (error) {
				console.log(`ChromiumDownloadService: 设置执行权限失败: ${error.message}`)
			}
		}
		
		console.log(`ChromiumDownloadService: Chrome准备就绪: ${executablePath}`)
		return executablePath
	}
	
	private async extractArchive(archivePath: string, targetDir: string): Promise<void> {
		try {
			// 优先使用AdmZip，跨平台兼容
			console.log('ChromiumDownloadService: 使用AdmZip解压缩...')
			const zip = new AdmZip(archivePath)
			zip.extractAllTo(targetDir, true)
			console.log('ChromiumDownloadService: AdmZip解压缩完成')
		} catch (error) {
			// 如果AdmZip失败，尝试使用系统命令作为后备
			console.log(`ChromiumDownloadService: AdmZip解压缩失败: ${error.message}，尝试系统命令`)
			
			const { exec } = require('child_process')
			const { promisify } = require('util')
			const execAsync = promisify(exec)
			
			try {
				if (process.platform === 'win32') {
					// Windows使用PowerShell解压缩
					await execAsync(`powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${targetDir}' -Force"`)
				} else {
					// Linux/Mac使用unzip
					await execAsync(`unzip -o "${archivePath}" -d "${targetDir}"`)
				}
				console.log('ChromiumDownloadService: 系统命令解压缩完成')
			} catch (systemError) {
				// 两种方法都失败了
				throw new Error(`解压缩失败: AdmZip错误: ${error.message}, 系统命令错误: ${systemError.message}`)
			}
		}
	}

	private async downloadFromMirror(): Promise<string> {
		const platformInfo = this.getPlatformInfo()
		console.log(`ChromiumDownloadService: 准备从镜像源下载Chrome`)
		console.log(`ChromiumDownloadService: 平台: ${platformInfo.platform}`)
		console.log(`ChromiumDownloadService: 可用版本: ${platformInfo.versions.join(', ')}`)
		
		let lastError: Error | null = null
		
		// 尝试每个版本，直到成功
		for (const version of platformInfo.versions) {
			try {
				console.log(`ChromiumDownloadService: 尝试版本 ${version}`)
				const downloadUrl = `https://registry.npmmirror.com/-/binary/chromium-browser-snapshots/${platformInfo.platform}/${version}/${platformInfo.archiveName}`
				
				const globalStoragePath = this.context?.globalStorageUri?.fsPath
				if (!globalStoragePath) {
					throw new Error("Global storage uri is invalid")
				}

				const puppeteerDir = path.join(globalStoragePath, "puppeteer")
				await fs.mkdir(puppeteerDir, { recursive: true })
				
				const executablePath = await this.downloadAndExtractChrome(downloadUrl, puppeteerDir, version)
				console.log(`ChromiumDownloadService: 成功使用版本 ${version}`)
				return executablePath
				
			} catch (error) {
				console.log(`ChromiumDownloadService: 版本 ${version} 失败: ${error.message}`)
				lastError = error as Error
				
				// 如果是网络错误或文件不存在，尝试下一个版本
				if (error.message.includes('404') || error.message.includes('下载失败')) {
					continue
				}
				
				// 如果是其他类型的错误（如解压缩失败），直接抛出
				throw error
			}
		}
		
		// 所有版本都失败了
		throw new Error(`所有镜像源版本都下载失败。最后错误: ${lastError?.message || '未知错误'}`)
	}

	async ensureChromiumExists(): Promise<PCRStats> {
		// 等待其他下载完成，最多等待1分钟
		let waitCount = 0
		const maxWaitCount = 60 // 60秒 = 1分钟
		
		while (ChromiumDownloadService.downloading && waitCount < maxWaitCount) {
			console.log(`ChromiumDownloadService: 等待其他下载: ${waitCount}秒`)
			await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒
			waitCount++
		}
		
		// 如果等待超时，记录日志
		if (waitCount >= maxWaitCount) {
			console.log('ChromiumDownloadService: 等待其他下载超时，继续执行')
		}

		const globalStoragePath = this.context?.globalStorageUri?.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}

		const puppeteerDir = path.join(globalStoragePath, "puppeteer")
		const dirExists = await fileExistsAtPath(puppeteerDir)
		if (!dirExists) {
			await fs.mkdir(puppeteerDir, { recursive: true })
		}

		// 首先检查本地是否已经存在可用的Chromium
		const existingChromium = await this.findExistingChromium(puppeteerDir)
		if (existingChromium) {
			console.log(`ChromiumDownloadService: 发现现有Chromium: ${existingChromium}`)
			return {
				puppeteer: { launch },
				executablePath: existingChromium
			}
		}

		console.log('ChromiumDownloadService: 本地未发现Chromium，准备下载')

		// 设置下载状态
		ChromiumDownloadService.downloading = true

		try {
			// 测试默认源可用性
			const defaultSourceAvailable = await this.testDefaultSourceAvailability()

			if (defaultSourceAvailable) {
				// 默认源可用，使用PCR正常流程
				console.log('ChromiumDownloadService: 使用默认源下载最新版本')
				
				const pcrConfig = {
					downloadPath: puppeteerDir,
					retry: 3,
					silent: false,
					hosts: ['https://storage.googleapis.com']
				}

				console.log('ChromiumDownloadService: PCR配置:', JSON.stringify(pcrConfig, null, 2))
				const stats: PCRStats = await PCR(pcrConfig)
				return stats
			} else {
				// 默认源不可用，直接下载并解压缩
				console.log('ChromiumDownloadService: 默认源不可用，使用镜像源直接下载')
				
				try {
					const executablePath = await this.downloadFromMirror()
					
					// 返回兼容的PCRStats对象
					const stats: PCRStats = {
						puppeteer: { launch },
						executablePath
					}
					
					return stats
				} catch (error) {
					console.log(`ChromiumDownloadService: 镜像源下载失败: ${error.message}`)
					console.log('ChromiumDownloadService: 强制尝试默认源作为最后手段')
					
					// 作为最后手段，强制尝试默认源
					const pcrConfig = {
						downloadPath: puppeteerDir,
						retry: 3,
						silent: false,
						hosts: ['https://storage.googleapis.com']
					}

					const stats: PCRStats = await PCR(pcrConfig)
					return stats
				}
			}
		} finally {
			// 无论成功失败，都要清理状态
			ChromiumDownloadService.downloading = false
		}
	}

	private async findExistingChromium(puppeteerDir: string): Promise<string | null> {
		try {
			const platformInfo = this.getPlatformInfo()
			const snapshotsBaseDir = path.join(puppeteerDir, '.chromium-browser-snapshots')
			
			if (!(await fileExistsAtPath(snapshotsBaseDir))) {
				return null
			}

			// 1. 首先检查PCR标准格式: chromium/win64-xxx/ 或 chromium/mac-xxx/ 或 chromium/linux-xxx/
			const pcrChromiumDir = path.join(snapshotsBaseDir, 'chromium')
			if (await fileExistsAtPath(pcrChromiumDir)) {
				console.log(`ChromiumDownloadService: 检查PCR标准格式路径: ${pcrChromiumDir}`)
				
				try {
					const pcrVersionDirs = await fs.readdir(pcrChromiumDir)
					for (const versionDir of pcrVersionDirs) {
						// PCR使用不同的可执行文件路径结构
						let pcrExecutablePath: string
						
						if (process.platform === 'win32') {
							// Windows: chrome-win/chrome.exe
							pcrExecutablePath = path.join(pcrChromiumDir, versionDir, 'chrome-win', 'chrome.exe')
						} else if (process.platform === 'darwin') {
							// macOS: chrome-mac/Chromium.app/Contents/MacOS/Chromium
							pcrExecutablePath = path.join(pcrChromiumDir, versionDir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
						} else {
							// Linux: chrome-linux/chrome
							pcrExecutablePath = path.join(pcrChromiumDir, versionDir, 'chrome-linux', 'chrome')
						}
						
						if (await fileExistsAtPath(pcrExecutablePath)) {
							console.log(`ChromiumDownloadService: 找到PCR格式的现有Chromium版本 ${versionDir}: ${pcrExecutablePath}`)
							return pcrExecutablePath
						}
					}
				} catch (error) {
					console.log(`ChromiumDownloadService: 检查PCR格式时出错: ${error.message}`)
				}
			}

			// 2. 然后检查自定义格式: Win_x64/version/ 等
			const customSnapshotsDir = path.join(snapshotsBaseDir, platformInfo.platform)
			if (await fileExistsAtPath(customSnapshotsDir)) {
				console.log(`ChromiumDownloadService: 检查自定义格式路径: ${customSnapshotsDir}`)
				
				try {
					const versionDirs = await fs.readdir(customSnapshotsDir)
					for (const versionDir of versionDirs) {
						const executablePath = path.join(customSnapshotsDir, versionDir, platformInfo.executableName)
						if (await fileExistsAtPath(executablePath)) {
							console.log(`ChromiumDownloadService: 找到自定义格式的现有Chromium版本 ${versionDir}: ${executablePath}`)
							return executablePath
						}
					}
				} catch (error) {
					console.log(`ChromiumDownloadService: 检查自定义格式时出错: ${error.message}`)
				}
			}

			console.log(`ChromiumDownloadService: 未找到任何现有的Chromium安装`)
			return null
		} catch (error) {
			console.log(`ChromiumDownloadService: 检查现有Chromium时出错: ${error.message}`)
			return null
		}
	}
}
