import { BaseSearchEngineConfig } from "./base_search_engine_config"

/**
 * 搜狗搜索配置
 */
export class SogouConfig {
	static getConfig(): BaseSearchEngineConfig {
		return new BaseSearchEngineConfig({
			// 重写必需字段
			name: 'sogou_search',
			homepageUrl: 'https://www.sogou.com/',
			
			// 重写可选字段
			cookieDomain: 'sogou.com',
			
			// 重写JavaScript代码
			inputAndSubmitJs: `
				(() => {
					const searchInput = document.getElementById('query');
					if (searchInput && searchInput.offsetParent !== null) { // Check visibility
						searchInput.value = '${BaseSearchEngineConfig.PLACEHOLDERS.QUERY}';
						const form = document.getElementById('sf');
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
					return currentURL.includes('sogou.com/web?');
				})()
			`,
			
			extractResultsJs: `
				(() => {
					const results = [];
					const contentDiv = document.getElementById('main');
					if (!contentDiv) return results;
					
					// 获取所有class="vrwrap"的div（不一定是直接子div）
					const itemDivs = contentDiv.querySelectorAll('div.vrwrap');

					itemDivs.forEach(itemDiv => {
						try {
							// 提取title
							const h3Element = itemDiv.querySelector('h3');
							const title = h3Element ? h3Element.textContent.trim() : '无标题';
							
							// 提取url - 复杂逻辑
							let url1 = '';
							let url2 = '';
							
							// 获取url1: class包含result_list的div的data-url属性
							const resultListDiv = itemDiv.querySelector('div[class*="result_list"]');
							if (resultListDiv) {
								url1 = resultListDiv.getAttribute('data-url') || '';
							}
							
							// 获取url2: h3内a标签的href
							if (h3Element) {
								const linkElement = h3Element.querySelector('a');
								if (linkElement && linkElement.href) {
									url2 = linkElement.href;
									// 判断是否是相对路径，如果是则补全
									if (url2.startsWith('/')) {
										url2 = 'https://www.sogou.com' + url2;
									}
								}
							}
							
							// URL选择逻辑：如果url1包含weixin.qq.com，必须使用url2
							let finalUrl = '';
							if (url1 && url1.includes('weixin.qq.com')) {
								finalUrl = url2;
							} else if (url1) {
								finalUrl = url1;
							} else {
								finalUrl = url2;
							}
							
							// 提取description
							let description = '无描述';
							const textLayoutDiv = itemDiv.querySelector('div.text-layout');
							if (textLayoutDiv) {
								description = textLayoutDiv.textContent.trim();
								if (description.length > 300) {
									description = description.substring(0, 297) + '...';
								}
							}
							description = description.replace(/\\s+/g, ' ').trim();
							
							if (title && finalUrl) {
								results.push({ title, url: finalUrl, description });
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
					const nextPageButton = document.getElementById('sogou_next');
					if (nextPageButton && nextPageButton.offsetParent !== null) {
						console.log('[SogouConfig] Found next page button:', nextPageButton.outerHTML);
						nextPageButton.click();
						return true;
					}
					return false;
				})()
			`
		});
	}
} 