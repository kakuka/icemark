import { useCallback, useState, useEffect } from "react"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { validateApiConfiguration } from "@src/utils/validate"
import { vscode } from "@src/utils/vscode"
import ApiOptions from "../settings/ApiOptions"
import { Tab, TabContent } from "../common/Tab"
import { Trans } from "react-i18next"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { getRequestyAuthUrl, getOpenRouterAuthUrl } from "@src/oauth/urls"
import RooHero from "./IcemarkHero"
import RooTips from "./RooTips"
import knuthShuffle from "knuth-shuffle-seeded"
import { Language } from "@roo/shared/language"

const WelcomeView = () => {
	const { apiConfiguration, currentApiConfigName, setApiConfiguration, uriScheme, machineId, language } =
		useExtensionState()
	const { t } = useAppTranslation()
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
	const [selectedLanguage, setSelectedLanguage] = useState(language || "en")

	// 同步外部语言状态变化
	useEffect(() => {
		setSelectedLanguage(language || "en")
	}, [language])

	const handleSubmit = useCallback(() => {
		const error = apiConfiguration ? validateApiConfiguration(apiConfiguration) : undefined

		if (error) {
			setErrorMessage(error)
			return
		}

		setErrorMessage(undefined)
		vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration })
	}, [apiConfiguration, currentApiConfigName])

	// 语言切换适配器函数
	const handleLanguageChange = useCallback((field: "language", value: Language | undefined) => {
		const safeValue = value || "en"
		setSelectedLanguage(safeValue)
		// 立即发送到 vscode，实现即时生效
		vscode.postMessage({ type: "language", text: safeValue })
	}, [])

	// Using a lazy initializer so it reads once at mount
	const [imagesBaseUri] = useState(() => {
		const w = window as any
		return w.IMAGES_BASE_URI || ""
	})

	return (
		<Tab>
			<TabContent className="flex flex-col gap-5">
				{/* 顶部语言选择器 */}
				<div className="flex justify-end items-center gap-3 text-sm">
					<span
						className={`transition-colors ${
							selectedLanguage === "zh-CN" ? "cursor-default" : "cursor-pointer hover:opacity-80"
						}`}
						style={{
							color:
								selectedLanguage === "zh-CN"
									? "var(--vscode-foreground)"
									: "var(--vscode-textLink-foreground, #0078d4)",
						}}
						onClick={() => selectedLanguage !== "zh-CN" && handleLanguageChange("language", "zh-CN")}>
						中文
					</span>
					<span
						className={`transition-colors ${
							selectedLanguage === "en" ? "cursor-default" : "cursor-pointer hover:opacity-80"
						}`}
						style={{
							color:
								selectedLanguage === "en"
									? "var(--vscode-foreground)"
									: "var(--vscode-textLink-foreground, #0078d4)",
						}}
						onClick={() => selectedLanguage !== "en" && handleLanguageChange("language", "en")}>
						English
					</span>
					<img
						src={imagesBaseUri + "/change_language.png"}
						alt="Change language"
						className="w-8 h-8 opacity-70"
					/>
				</div>

				<RooHero />
				<h2 className="mx-auto">{t("chat:greeting")}</h2>

				<div className="outline rounded p-4">
					<Trans i18nKey="welcome:introduction" />
				</div>

				<div className="mb-4">
					{/* <h4 className="mt-3 mb-2 text-center">{t("welcome:startRouter")}</h4> */}

					<div className="flex gap-4">
						{/* Define the providers */}
						{(() => {
							// Provider card configuration
							const providers = [
								{
									slug: "requesty",
									name: "Requesty",
									description: t("welcome:routers.requesty.description"),
									// incentive: t("welcome:routers.requesty.incentive"),
									authUrl: getRequestyAuthUrl(uriScheme),
								},
								{
									slug: "openrouter",
									name: "OpenRouter",
									description: t("welcome:routers.openrouter.description"),
									authUrl: getOpenRouterAuthUrl(uriScheme),
								},
							]

							// Shuffle providers based on machine ID (will be consistent for the same machine)
							const orderedProviders = [...providers]
							knuthShuffle(orderedProviders, (machineId as any) || Date.now())

							// Render the provider cards
							// const temp = orderedProviders.map((provider, index) => (
							// 	<a
							// 		key={index}
							// 		href={provider.authUrl}
							// 		className="flex-1 border border-vscode-panel-border rounded p-4 flex flex-col items-center cursor-pointer transition-all  no-underline text-inherit"
							// 		target="_blank"
							// 		rel="noopener noreferrer">
							// 		<div className="font-bold">{provider.name}</div>
							// 		<div className="w-16 h-16 flex items-center justify-center rounded m-2 overflow-hidden relative">
							// 			<img
							// 				src={`${imagesBaseUri}/${provider.slug}.png`}
							// 				alt={provider.name}
							// 				className="w-full h-full object-contain p-2"
							// 			/>
							// 		</div>
							// 		<div className="text-center">
							// 			<div className="text-xs text-vscode-descriptionForeground">
							// 				{provider.description}
							// 			</div>
							// 			{/* {provider.incentive && (
							// 				<div className="text-xs font-bold">{provider.incentive}</div>
							// 			)} */}
							// 		</div>
							// 	</a>
							// ))
							const tipStr = t("welcome:providerTip")
							return tipStr
						})()}
					</div>

					<RooTips cycle={false} />

					{/* <div className="text-center my-4 text-xl uppercase font-bold">{t("welcome:or")}</div> */}
					<h4 className="mt-3 mb-2 text-center">{t("welcome:startCustom")}</h4>
					<ApiOptions
						fromWelcomeView
						apiConfiguration={apiConfiguration || {}}
						uriScheme={uriScheme}
						setApiConfigurationField={(field, value) => setApiConfiguration({ [field]: value })}
						errorMessage={errorMessage}
						setErrorMessage={setErrorMessage}
					/>
				</div>
			</TabContent>
			<div className="sticky bottom-0 bg-vscode-sideBar-background p-5">
				<div className="flex flex-col gap-1">
					<div className="flex justify-end">
						<VSCodeLink
							href="#"
							onClick={(e) => {
								e.preventDefault()
								vscode.postMessage({ type: "importSettings" })
							}}
							className="text-sm">
							{t("welcome:importSettings")}
						</VSCodeLink>
					</div>
					<VSCodeButton onClick={handleSubmit} appearance="primary">
						{t("welcome:start")}
					</VSCodeButton>
					{errorMessage && <div className="text-vscode-errorForeground">{errorMessage}</div>}
				</div>
			</div>
		</Tab>
	)
}

export default WelcomeView
