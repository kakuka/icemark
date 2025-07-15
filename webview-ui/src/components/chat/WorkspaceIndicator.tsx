import React, { useMemo, useState } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useCopyToClipboard } from "@src/utils/clipboard"
import { IceViewer } from "./IceViewer"

export interface WorkspaceIndicatorProps {
	className?: string
	expanded: boolean
	onToggle: (expanded: boolean) => void
}

const WorkspaceIndicator: React.FC<WorkspaceIndicatorProps> = ({ className, expanded, onToggle }) => {
	const { t } = useAppTranslation()
	const { cwd } = useExtensionState()
	const { copyWithFeedback } = useCopyToClipboard()
	const [showCopySuccess, setShowCopySuccess] = useState(false)

	// 判断是否有工作区 - 如果有cwd说明有工作区
	const hasWorkspace = Boolean(cwd)

	// 获取显示路径
	const displayPath = useMemo(() => {
		const path = cwd || ""
		if (!path) return ""

		// 路径截断逻辑
		if (path.length <= 50) {
			return path
		}

		// 长路径截断
		const parts = path.split(/[/\\]/)
		if (parts.length <= 2) {
			return path
		}

		// 显示开头和最后两级目录
		const start = parts[0]
		const end = parts.slice(-2).join("/")
		return `${start}/.../${end}`
	}, [cwd])

	// 处理设置/切换工作区
	const handleSetOrSwitchWorkspace = () => {
		// 发送消息到扩展，让扩展执行VSCode的打开文件夹命令
		vscode.postMessage({ type: "openFolder" })
	}

	// 处理帮助
	const handleHelp = () => {
		vscode.postMessage({ 
			type: "openExternal", 
			text: "https://code.visualstudio.com/docs/editing/workspaces/workspaces" 
		})
	}

	// 处理路径点击 - 打开系统文件管理器
	const handlePathClick = () => {
		if (displayPath && cwd) {
			// 使用revealInExplorer在系统文件管理器中显示文件夹
			vscode.postMessage({ 
				type: "revealInExplorer", 
				text: cwd 
			})
		}
	}

	// 处理路径拷贝
	const handleCopyPath = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (cwd) {
			copyWithFeedback(cwd).then((success) => {
				if (success) {
					setShowCopySuccess(true)
					setTimeout(() => {
						setShowCopySuccess(false)
					}, 1000)
				}
			})
		}
	}

	// 处理展开/折叠切换
	const handleToggle = () => {
		onToggle(!expanded)
	}

	return (
		<div 
			className={`${className || ""}`}
			style={{
				backgroundColor: "var(--vscode-sideBar-Background)",
				borderRadius: "6px",
				border: "1px solid var(--vscode-panel-border)",
				overflow: "hidden"
			}}
		>
			{/* 可点击的标题行 */}
			<div 
				className="cursor-pointer select-none transition-colors duration-200"
				style={{
					padding: "8px 12px",
					display: "flex",
					alignItems: "center",
					gap: "8px",
					backgroundColor: "var(--vscode-list-hoverBackground)"
				}}
				// onMouseEnter={(e) => {
				// 	e.currentTarget.style.backgroundColor = "var(--vscode-list-hoverBackground)"
				// }}
				// onMouseLeave={(e) => {
				// 	e.currentTarget.style.backgroundColor = "transparent"
				// }}
				onClick={handleToggle}
				title={expanded ? t("chat:workspace.collapse") : t("chat:workspace.expand")}
			>
				{/* 展开/折叠图标 */}
				{/* <span style={{ color: "var(--vscode-foreground)", fontSize: "12px" }}>
					{expanded ? '▽' : '▷'}
				</span> */}

				<span className={`codicon codicon-chevron-${expanded ? "down" : "right"}`}>

				</span>
				
				{/* 工作区状态 */}
				<span style={{ color: "var(--vscode-foreground)", fontSize: "12px", fontWeight: "500" }}>
					{t("chat:workspace.label")}
				</span>
				<span style={{ 
					color: hasWorkspace 
						? "var(--vscode-foreground)" 
						: "var(--vscode-notificationsWarningIcon-foreground)",
					fontSize: "12px",
					fontWeight: "500"
				}}>
					{/* {hasWorkspace ? t("chat:workspace.statusSet") : t("chat:workspace.statusNotSet")} */}

					{hasWorkspace ? <img src={`${(window as any).IMAGES_BASE_URI}/workspace.svg`} alt="workspace" width="18" height="18" />: t("chat:workspace.statusNotSet")}
					
				</span>
				
				{/* 弹性空间 */}
				<div style={{ flex: 1 }}></div>
				
				{/* 右侧操作按钮 */}
				<div 
					className="flex items-center gap-2"
					onClick={(e) => e.stopPropagation()}
				>
					<span 
						className="text-xs hover:underline cursor-pointer transition-all"
						style={{ color: "var(--vscode-textLink-foreground)" }}
						onClick={handleSetOrSwitchWorkspace}
					>
						{hasWorkspace 
							? t("chat:workspace.switchButton") 
							: t("chat:workspace.setButton")
						}
					</span>
					<span 
						className="text-xs hover:underline cursor-pointer transition-all"
						style={{ color: "var(--vscode-textLink-foreground)" }}
						onClick={handleHelp}
					>
						{t("chat:workspace.helpButton")}
					</span>
				</div>
			</div>

			{/* 可折叠的内容区域 */}
			<div 
				className={`transition-all duration-300 overflow-hidden`}
				style={{
					maxHeight: expanded ? '500px' : '0px'
				}}
			>
				<div style={{ 
					borderTop: "1px solid var(--vscode-panel-border)"
				}}>
					{/* 保存路径行 - 保持内边距 */}
					<div 
						className="flex items-center gap-1 mb-3"
						style={{ padding: "12px 12px 0 12px" }}
					>
						<span 
							className="text-xs whitespace-nowrap"
							style={{ color: "var(--vscode-descriptionForeground)" }}
						>
							{t("chat:workspace.fileSavePrefix")}
						</span>
						<span 
							className="text-xs hover:underline cursor-pointer truncate flex-1 transition-all"
							style={{ color: "var(--vscode-textLink-foreground)" }}
							onClick={handlePathClick}
							title={cwd || t("chat:workspace.clickToOpen")}
						>
							{displayPath || t("chat:workspace.noPath")}
						</span>
						{cwd && (
							<VSCodeButton
								appearance="icon"
								style={{
									padding: "3px",
									height: "18px",
									marginLeft: "4px",
									color: "var(--vscode-editor-foreground)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									background: "transparent",
								}}
								onClick={handleCopyPath}
								title={t("chat:workspace.copyPath")}
							>
								<span className={`codicon scale-80 codicon-${showCopySuccess ? "check" : "copy"}`}></span>
							</VSCodeButton>
						)}
					</div>

					{/* IceViewer 组件 - 占满宽度 */}
					{hasWorkspace && (
						<div style={{ padding: "0 12px 12px 12px" }}>
							<IceViewer />
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default WorkspaceIndicator 