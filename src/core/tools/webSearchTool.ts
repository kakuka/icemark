import { Cline } from "../Cline"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"

export async function webSearchTool(
	cline: Cline,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	_removeClosingTag: RemoveClosingTag,
) {
	const keywordListParam: string | undefined = block.params.keyword_list
	const pageLimitParam: string | undefined = block.params.page_limit
	const searchOnParam: string | undefined = block.params.search_on

	// 解析关键词列表
	let keywordList: string[] = []
	if (keywordListParam) {
		keywordList = keywordListParam
			.split(",")
			.map(k => k.trim())
			.filter(k => k.length > 0)
	}

	// 解析页数限制
	let pageLimit = 1 // 默认值
	if (pageLimitParam) {
		const parsedLimit = parseInt(pageLimitParam.trim(), 10)
		if (isNaN(parsedLimit) || parsedLimit < 1) {
			pageLimit = 1
		} else if (parsedLimit > 10) {
			pageLimit = 10 // 最大值限制
		} else {
			pageLimit = parsedLimit
		}
	}

	// 解析搜索平台
	const validPlatforms = ['general', 'xiaohongshu', 'zhihu', 'weibo']
	let searchOn = 'general' // 默认值
	if (searchOnParam) {
		const platform = searchOnParam.trim().toLowerCase()
		if (validPlatforms.includes(platform)) {
			searchOn = platform
		}
	}

	const sharedMessageProps: ClineSayTool = {
		tool: "webSearch",
		keywordList: keywordList.length > 0 ? keywordList : undefined,
		pageLimit: pageLimit,
		searchOn: searchOn,
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: undefined } satisfies ClineSayTool)

			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			// 验证必需参数
			if (!keywordListParam) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("web_search")
				pushToolResult(await cline.sayAndCreateMissingParamError("web_search", "keyword_list"))
				return
			}

			// 验证关键词列表
			if (keywordList.length === 0) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("web_search")
				await cline.say("error", `Icemark tried to search with empty keyword list. Please provide at least one valid keyword. Retrying...`)
				pushToolResult(formatResponse.toolError(`Empty keyword list. Please provide at least one valid keyword.`))
				return
			}

			if (keywordList.length >= 5) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("web_search")
				await cline.say("error", `Icemark tried to search with too many keywords (${keywordList.length}). Maximum 4 keywords allowed. Retrying...`)
				pushToolResult(formatResponse.toolError(`Too many keywords (${keywordList.length}). Maximum 4 keywords allowed (length < 5).`))
				return
			}

			cline.consecutiveMistakeCount = 0

			// 根据搜索平台显示不同的搜索信息
			const platformNames: Record<string, string> = {
				'general': '通用搜索引擎',
				'xiaohongshu': '小红书',
				'zhihu': '知乎',
				'weibo': '微博'
			}

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: `在 ${platformNames[searchOn]} 上搜索 ${pageLimit} 页结果: ${keywordList.join(", ")}`,
			} satisfies ClineSayTool)

			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			await cline.say("text", `正在在 ${platformNames[searchOn]} 上搜索关键词: ${keywordList.join(", ")}，页数限制: ${pageLimit}...`)

			try {
				await cline.say("text", "正在执行网络搜索...")
				
				// 执行搜索，传递新的参数
				const searchResults = await cline.searchEngineService.search(keywordList, pageLimit, searchOn)

				const resultCount = searchResults.length
				await cline.say("text", `搜索完成，找到 ${resultCount} 条结果`)

				// 格式化搜索结果
				const formattedResults = searchResults.map((result, index) => ({
					rank: index + 1,
					title: result.title,
					url: result.url,
					snippet: result.snippet,
					domain: result.domain,
				}))

				// 创建结果摘要
				const summary = {
					keywords: keywordList,
					page_limit: pageLimit,
					search_on: searchOn,
					total_results: resultCount,
					results: formattedResults,
				}

				// 创建可读的结果文本
				let resultText = `Web Search Results for: ${keywordList.join(", ")}\n`
				resultText += `Search Platform: ${platformNames[searchOn]}\n`
				resultText += `Page Limit: ${pageLimit}\n`
				resultText += `Total Results: ${resultCount}\n\n`

				formattedResults.forEach((result, index) => {
					resultText += `## result ${index + 1}. ${result.title}\n`
					resultText += `   URL: ${result.url}\n`
					resultText += `   Domain: ${result.domain}\n`
					resultText += `   Snippet:\n> ${result.snippet}\n\n`
				})

				await cline.say("text", resultText)

				// 返回JSON格式的结果
				pushToolResult(formatResponse.toolResult(JSON.stringify(summary, null, 2)))

				return
			} catch (error) {
				await cline.say("error", `搜索失败: ${error}`)
				await handleError("performing web search", error)
				return
			}
		}
	} catch (error) {
		await handleError("performing web search", error)
		return
	}
} 