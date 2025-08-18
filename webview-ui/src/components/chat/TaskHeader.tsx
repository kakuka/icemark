import { memo, useRef, useState, useEffect } from "react"
import { useWindowSize } from "react-use"
import { useTranslation } from "react-i18next"
import { VSCodeBadge } from "@vscode/webview-ui-toolkit/react"
import { CloudUpload, CloudDownload } from "lucide-react"

import { ClineMessage } from "@roo/shared/ExtensionMessage"

import { getMaxTokensForModel } from "@src/utils/model-utils"
import { formatLargeNumber } from "@src/utils/format"
import { cn } from "@src/lib/utils"
import { Button } from "@src/components/ui"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"
import { vscode } from "@src/utils/vscode"

import Thumbnails from "../common/Thumbnails"

import { TaskActions } from "./TaskActions"
import { ContextWindowProgress } from "./ContextWindowProgress"
import { Mention } from "./Mention"

export interface TaskHeaderProps {
	task: ClineMessage
	tokensIn: number
	tokensOut: number
	doesModelSupportPromptCache: boolean
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	contextTokens: number
	onClose: () => void
}

const TaskHeader = ({
	task,
	tokensIn,
	tokensOut,
	doesModelSupportPromptCache,
	cacheWrites,
	cacheReads,
	totalCost,
	contextTokens,
	onClose,
}: TaskHeaderProps) => {
	const { t } = useTranslation()
	const { apiConfiguration, currentTaskItem, currentTodoList, currentTaskReminder } = useExtensionState()
	const { info: model } = useSelectedModel(apiConfiguration)
	const [isTaskExpanded, setIsTaskExpanded] = useState(false)
	const [isReminderExpanded, setIsReminderExpanded] = useState(false)
	const [reminderText, setReminderText] = useState(currentTaskReminder || "")

	// Precompute todo progress to avoid calling hooks inside callbacks
	const todoCompleted = currentTodoList?.completedCount ?? 0
	const todoTotal = currentTodoList?.totalCount ?? 0
	const todoPercent = todoTotal > 0 ? Math.round((todoCompleted * 100) / todoTotal) : 0

	// Calculate reminder line count (only count non-empty lines)
	const reminderLineCount = currentTaskReminder 
		? currentTaskReminder.split('\n').filter(line => line.trim().length > 0).length 
		: 0

	// Update reminder text when currentTaskReminder changes
	useEffect(() => {
		console.log('TaskHeader: currentTaskReminder changed:', currentTaskReminder)
		setReminderText(currentTaskReminder || "")
	}, [currentTaskReminder])

	// Debug: Log state changes
	useEffect(() => {
		console.log('TaskHeader: reminderText state:', reminderText)
		console.log('TaskHeader: isReminderExpanded:', isReminderExpanded)
	}, [reminderText, isReminderExpanded])

	const textContainerRef = useRef<HTMLDivElement>(null)
	const textRef = useRef<HTMLDivElement>(null)
	const contextWindow = model?.contextWindow || 1

	const { width: windowWidth } = useWindowSize()

	const handleReminderClick = () => {
		setIsReminderExpanded(!isReminderExpanded)
	}

	const handleReminderSave = () => {
		vscode.postMessage({
			type: "updateTaskReminder",
			text: reminderText,
		})
		setIsReminderExpanded(false)
	}

	const handleReminderCancel = () => {
		setReminderText(currentTaskReminder || "")
		setIsReminderExpanded(false)
	}

	return (
		<div className="py-2 px-3">
			<div
				className={cn(
					"rounded-xs p-2.5 flex flex-col gap-1.5 relative z-1 border",
					!!isTaskExpanded
						? "border-vscode-panel-border text-vscode-foreground"
						: "border-vscode-panel-border/80 text-vscode-foreground/80",
				)}>
				<div className="flex justify-between items-center gap-2">
					<div
						className="flex items-center cursor-pointer -ml-0.5 select-none grow min-w-0"
						onClick={() => setIsTaskExpanded(!isTaskExpanded)}>
						<div className="flex items-center shrink-0">
							<span className={`codicon codicon-chevron-${isTaskExpanded ? "down" : "right"}`}></span>
						</div>
						<div className="ml-1.5 whitespace-nowrap overflow-hidden text-ellipsis grow min-w-0">
							<span className="font-bold">
								{t("chat:task.title")}
								{!isTaskExpanded && ":"}
							</span>
							{!isTaskExpanded && (
								<span className="ml-1">
									<Mention text={task.text} />
								</span>
							)}
						</div>
					</div>
					<div className="flex items-center gap-1 shrink-0">
						{reminderLineCount > 0 ? (
							<span
								className="cursor-pointer text-xs font-bold text-vscode-foreground/80 hover:text-vscode-foreground transition-colors"
								onClick={handleReminderClick}
								title={t("chat:task.reminderTooltip")}
							>
								{t("chat:task.reminder")}({reminderLineCount})
							</span>
						) : (
							<span
								className="cursor-pointer text-xs font-bold text-vscode-foreground/60 hover:text-vscode-foreground/80 transition-colors"
								onClick={handleReminderClick}
								title={t("chat:task.addReminderTooltip")}
							>
								{t("chat:task.reminder")}(0)
							</span>
						)}
						<Button
							variant="ghost"
							size="icon"
							onClick={onClose}
							title={t("chat:task.closeAndStart")}
							className="shrink-0 w-5 h-5">
							<span className="codicon codicon-close" />
						</Button>
					</div>
				</div>
				{/* Collapsed state: Track context and cost if we have any */}
				{!isTaskExpanded && contextWindow > 0 && (
					<div className={`w-full flex flex-row gap-1 h-auto`}>
						<ContextWindowProgress
							contextWindow={contextWindow}
							contextTokens={contextTokens || 0}
							maxTokens={getMaxTokensForModel(model, apiConfiguration)}
						/>
						{!!totalCost && <VSCodeBadge>${totalCost.toFixed(2)}</VSCodeBadge>}
					</div>
				)}
				{/* Expanded state: Show task text and images */}
				{isTaskExpanded && (
					<>
						<div
							ref={textContainerRef}
							className="-mt-0.5 text-vscode-font-size overflow-y-auto break-words break-anywhere relative">
							<div
								ref={textRef}
								className="overflow-auto max-h-80 whitespace-pre-wrap break-words break-anywhere"
								style={{
									display: "-webkit-box",
									WebkitLineClamp: "unset",
									WebkitBoxOrient: "vertical",
								}}>
								<Mention text={task.text} />
							</div>
						</div>
						{task.images && task.images.length > 0 && <Thumbnails images={task.images} />}

						<div className="flex flex-col gap-1">
							{(currentTaskItem && (currentTaskItem as any)) !== undefined && todoTotal > 0 && (
								<div className="flex items-center gap-1 flex-wrap h-[20px]">
									<span className="font-bold">{t("chat:task.todo")}</span>
									<span className="flex items-center gap-0.5">{todoCompleted}/{todoTotal} ({todoPercent}%)</span>
								</div>
							)}
							{isTaskExpanded && contextWindow > 0 && (
								<div
									className={`w-full flex ${windowWidth < 400 ? "flex-col" : "flex-row"} gap-1 h-auto`}>
									<div className="flex items-center gap-1 flex-shrink-0">
										<span className="font-bold" data-testid="context-window-label">
											{t("chat:task.contextWindow")}
										</span>
									</div>
									<ContextWindowProgress
										contextWindow={contextWindow}
										contextTokens={contextTokens || 0}
										maxTokens={getMaxTokensForModel(model, apiConfiguration)}
									/>
								</div>
							)}
							<div className="flex justify-between items-center h-[20px]">
								<div className="flex items-center gap-1 flex-wrap">
									<span className="font-bold">{t("chat:task.tokens")}</span>
									{typeof tokensIn === "number" && tokensIn > 0 && (
										<span className="flex items-center gap-0.5">
											<i className="codicon codicon-arrow-up text-xs font-bold" />
											{formatLargeNumber(tokensIn)}
										</span>
									)}
									{typeof tokensOut === "number" && tokensOut > 0 && (
										<span className="flex items-center gap-0.5">
											<i className="codicon codicon-arrow-down text-xs font-bold" />
											{formatLargeNumber(tokensOut)}
										</span>
									)}
								</div>
								{!totalCost && <TaskActions item={currentTaskItem} />}
							</div>

							{doesModelSupportPromptCache &&
								((typeof cacheReads === "number" && cacheReads > 0) ||
									(typeof cacheWrites === "number" && cacheWrites > 0)) && (
									<div className="flex items-center gap-1 flex-wrap h-[20px]">
										<span className="font-bold">{t("chat:task.cache")}</span>
										{typeof cacheWrites === "number" && cacheWrites > 0 && (
											<span className="flex items-center gap-0.5">
												<CloudUpload size={16} />
												{formatLargeNumber(cacheWrites)}
											</span>
										)}
										{typeof cacheReads === "number" && cacheReads > 0 && (
											<span className="flex items-center gap-0.5">
												<CloudDownload size={16} />
												{formatLargeNumber(cacheReads)}
											</span>
										)}
									</div>
								)}

							{!!totalCost && (
								<div className="flex justify-between items-center h-[20px]">
									<div className="flex items-center gap-1">
										<span className="font-bold">{t("chat:task.apiCost")}</span>
										<span>${totalCost?.toFixed(2)}</span>
									</div>
									<TaskActions item={currentTaskItem} />
								</div>
							)}
						</div>
					</>
				)}
				
				{/* Reminder editing area */}
				{isReminderExpanded && (
					<div 
						className="mt-3 p-3 border-t border-vscode-panel-border bg-vscode-editor-background/30 rounded-b-xs"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between mb-2">
							<span className="font-bold text-sm">{t("chat:task.userReminder")}</span>
						</div>
						<textarea
							value={reminderText}
							onChange={(e) => {
								console.log('Textarea onChange triggered:', e.target.value)
								setReminderText(e.target.value)
							}}
							onInput={(e) => {
								console.log('Textarea onInput triggered:', e.currentTarget.value)
							}}
							onFocus={() => {
								console.log('Textarea focused')
							}}
							placeholder={t("chat:task.reminderPlaceholder")}
							className="w-full h-24 p-2 text-sm bg-vscode-input-background border border-vscode-input-border rounded resize-none focus:outline-none focus:border-vscode-focusBorder"
							style={{ fontFamily: 'var(--vscode-editor-font-family)' }}
							onClick={(e) => e.stopPropagation()}
						/>
						<div className="flex justify-end gap-2 mt-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={handleReminderCancel}
								className="text-xs h-6 px-2"
							>
								{t("chat:task.cancel")}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleReminderSave}
								className="text-xs h-6 px-2 bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground"
							>
								{t("chat:task.save")}
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

export default memo(TaskHeader)
