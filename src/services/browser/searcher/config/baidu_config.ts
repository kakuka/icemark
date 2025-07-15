import { BaseSearchEngineConfig } from "./base_search_engine_config"

/**
 * 百度搜索配置
 */
export class BaiduConfig {
	static getConfig(): BaseSearchEngineConfig {
		return new BaseSearchEngineConfig({
			// 重写必需字段
			name: 'baidu_search',
			homepageUrl: 'https://www.baidu.com/',
			
			// 重写可选字段
			cookieDomain: 'baidu.com',
			
			// 重写JavaScript代码
			inputAndSubmitJs: `
				(() => {
					const searchInput = document.getElementById('kw');
					if (searchInput && searchInput.offsetParent !== null) { // Check visibility
						searchInput.value = '${BaseSearchEngineConfig.PLACEHOLDERS.QUERY}';
						const form = document.getElementById('form');
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
					return currentURL.includes('baidu.com/s');
				})()
			`,
			
			extractResultsJs: `
				(() => {
					const results = [];
					const contentDiv = document.getElementById('content_left');
					if (!contentDiv) return results;
					
					// 获取直接子div，class包含result或result-op
					const itemDivs = Array.from(contentDiv.children).filter(child => {
						return child.tagName === 'DIV' && 
							   (child.className.includes('result') || child.className.includes('result-op'));
					});

					itemDivs.forEach(itemDiv => {
						try {
							// 提取title
							const h3Element = itemDiv.querySelector('h3');
							const title = h3Element ? h3Element.textContent.trim() : '无标题';
							
							// 提取url - 优先使用mu属性
							let url = '';
							const muAttribute = itemDiv.getAttribute('mu');
							if (muAttribute) {
								url = muAttribute;
							} else {
								// 使用h3内a标签的href
								const linkElement = h3Element ? h3Element.querySelector('a') : null;
								if (linkElement && linkElement.href) {
									url = linkElement.href;
								}
							}
							
							// 提取description
							let description = '无描述';
							const abstractDiv = itemDiv.querySelector('div[data-module="abstract"]');
							if (abstractDiv) {
								description = abstractDiv.textContent.trim();
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
					const pageDiv = document.getElementById('page');
					if (pageDiv) {
						const allLinks = pageDiv.querySelectorAll('a');
						if (allLinks.length > 0) {
							const lastLink = allLinks[allLinks.length - 1];
							if (lastLink && lastLink.offsetParent !== null) {
								console.log('[BaiduConfig] Found next page button:', lastLink.outerHTML);
								lastLink.click();
								return true;
							}
						}
					}
					return false;
				})()
			`
		});
	}
} 