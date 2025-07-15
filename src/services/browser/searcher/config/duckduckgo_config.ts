import { BaseSearchEngineConfig } from "./base_search_engine_config"

/**
 * DuckDuckGo搜索配置（HTML版本）
 */
export class DuckDuckGoConfig {
	static getConfig(): BaseSearchEngineConfig {
		return new BaseSearchEngineConfig({
			// 重写必需字段
			name: 'duckduckgo_search',
			homepageUrl: 'https://html.duckduckgo.com/html/',
			
			// 重写可选字段
			cookieDomain: 'duckduckgo.com',
			
			// 重写JavaScript代码
			inputAndSubmitJs: `
				(() => {
					const searchInput = document.getElementById('search_form_input_homepage');
					if (searchInput && searchInput.offsetParent !== null) { // Check visibility
						searchInput.value = '${BaseSearchEngineConfig.PLACEHOLDERS.QUERY}';
						const form = document.getElementById('search_form_homepage');
						if (form && typeof form.submit === 'function') {
							form.submit();
							return true;
						} else {
							const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
							searchInput.dispatchEvent(enterEvent);
							return true;
						}
					}
					return false; // Not found or not visible
				})()
			`,
			
			validatePageJs: `
				(() => {
					const currentURL = window.location.href;
					return currentURL.includes('html.duckduckgo.com/html/');
				})()
			`,
			
			extractResultsJs: `
				(() => {
					const results = [];
					const contentDiv = document.getElementById('links');
					if (!contentDiv) return results;
					
					// 获取所有class包含result的div元素
					const itemDivs = contentDiv.querySelectorAll('div[class*="result"]');

					itemDivs.forEach(itemDiv => {
						try {
							// 提取title：h2标签的文本内容
							const h2Element = itemDiv.querySelector('h2');
							const title = h2Element ? h2Element.textContent.trim() : '无标题';
							
							// 提取url：h2内a标签的href
							let url = '';
							if (h2Element) {
								const linkElement = h2Element.querySelector('a');
								if (linkElement && linkElement.href) {
									url = linkElement.href;
								}
							}
							
							// 提取description：class="result__snippet"的a标签文本
							let description = '无描述';
							const snippetElement = itemDiv.querySelector('a.result__snippet');
							if (snippetElement) {
								description = snippetElement.textContent.trim();
								if (description.length > 300) {
									description = description.substring(0, 297) + '...';
								}
							}
							description = description.replace(/\\s+/g, ' ').trim();
							
							if (title && url) {
								results.push({ title, url, description });
							}
						} catch (err) {
							console.error('Error extracting single result item:', err);
						}
					});
					
					return results;
				})()
			`,
			
			clickNextPageJs: `
				(() => {
					const nextButton = document.querySelector('#links > div.nav-link > form > input.btn.btn--alt');
					if (nextButton && nextButton.offsetParent !== null) {
						console.log('[DuckDuckGoConfig] Found next page button:', nextButton.outerHTML);
						nextButton.click();
						return true;
					}
					return false;
				})()
			`
		});
	}
} 