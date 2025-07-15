import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useTranslation } from "react-i18next"
import { useState, useEffect } from "react"
import clsx from "clsx"

const tips = [
	
	{
		icon: "codicon-globe",
		href: "https://www.icemark.tech",
		titleKey: "rooTips.website.title",
		descriptionKey: "rooTips.website.description",
	},
	{
		icon: "codicon-book",
		href: "",
		titleKey: "rooTips.document.title",
		descriptionKey: "rooTips.document.description",
	},
]

interface RooTipsProps {
	cycle?: boolean
}

const RooTips = ({ cycle = false }: RooTipsProps) => {
	const { t } = useTranslation("chat")
	const [currentTipIndex, setCurrentTipIndex] = useState(Math.floor(Math.random() * tips.length))
	const [isFading, setIsFading] = useState(false)

	useEffect(() => {
		if (!cycle) return

		const intervalId = setInterval(() => {
			setIsFading(true) // Start fade out
			setTimeout(() => {
				setCurrentTipIndex((prevIndex) => (prevIndex + 1) % tips.length)
				setIsFading(false) // Start fade in
			}, 1000) // Fade duration
		}, 11000) // 10s display + 1s fade

		return () => clearInterval(intervalId) // Cleanup on unmount
	}, [cycle])

	const currentTip = tips[currentTipIndex]
	const topTwoTips = tips.slice(0, 2)

	return (
		<div
			className={clsx(
				"flex flex-col items-center justify-center px-6 py-4 gap-4",
				cycle && "h-[6em] overflow-visible m-6",
			)}>
			{/* If we need real estate, we show a compressed version of the tips. Otherwise, we expand it. */}
			{cycle ? (
				<>
					<div className="text-sm text-vscode-descriptionForeground font-medium tracking-wide mb-1 animate-pulse"> 
						✨ Did you know about...
					</div>
					<div
						className={clsx(
							"flex items-center gap-3 text-vscode-editor-foreground font-vscode max-w-[280px] transition-all duration-1000 ease-in-out transform",
							isFading ? "opacity-0 scale-95" : "opacity-100 scale-100",
						)}>
						<div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-vscode-button-background/15">
							<span className={`codicon ${currentTip.icon} text-vscode-button-foreground text-sm`}></span>
						</div>
						<div className="flex-1 min-w-0">
							<div className="font-semibold text-vscode-button-foreground mb-1">
								<VSCodeLink href={currentTip.href} className="hover:underline decoration-2 underline-offset-2">
									{t(currentTip.titleKey)}
								</VSCodeLink>
							</div>
							<div className="text-sm text-vscode-descriptionForeground leading-relaxed">
								{t(currentTip.descriptionKey)}
							</div>
						</div>
					</div>
				</>
			) : (
				<div className="space-y-3 w-full max-w-[320px]">
					{topTwoTips.map((tip) => (
						<div
							key={tip.titleKey}
							className="group flex items-center gap-3 p-3 rounded-lg bg-vscode-panel-background/20 hover:bg-vscode-panel-background/40 transition-all duration-300 ease-out">
							<div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-vscode-button-background/15 group-hover:bg-vscode-button-background/25 transition-colors duration-300">
								<span className={`codicon ${tip.icon} text-vscode-button-foreground`}></span>
							</div>
							<div className="flex-1 min-w-0">
								<div className="font-medium text-vscode-button-foreground mb-1 group-hover:text-vscode-button-hoverBackground transition-colors duration-200">
									<VSCodeLink 
										href={tip.href} 
										className="hover:underline decoration-1 underline-offset-2 transition-all duration-200"
									>
										{t(tip.titleKey)}
									</VSCodeLink>
								</div>
								<div className="text-sm text-vscode-descriptionForeground leading-relaxed group-hover:text-vscode-foreground/90 transition-colors duration-200">
									{t(tip.descriptionKey)}
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default RooTips
