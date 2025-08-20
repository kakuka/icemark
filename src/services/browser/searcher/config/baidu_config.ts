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
					const searchInput = document.getElementById('chat-textarea');
					if (searchInput && searchInput.offsetParent !== null) { // Check visibility
						// 清空当前内容并设置新的搜索查询
						searchInput.value = '';
						searchInput.focus();
						
						// 设置搜索内容
						const query = '${BaseSearchEngineConfig.PLACEHOLDERS.QUERY}';
						searchInput.value = query;
						
						// 触发input事件以确保页面识别到内容变化
						const inputEvent = new Event('input', { bubbles: true, cancelable: true });
						searchInput.dispatchEvent(inputEvent);
						
						// 模拟按下回车键触发搜索
						const enterEvent = new KeyboardEvent('keydown', { 
							key: 'Enter', 
							code: 'Enter', 
							keyCode: 13, 
							which: 13, 
							bubbles: true,
							cancelable: true
						});
						searchInput.dispatchEvent(enterEvent);
						
						// 也尝试keypress事件作为备选
						const keypressEvent = new KeyboardEvent('keypress', { 
							key: 'Enter', 
							code: 'Enter', 
							keyCode: 13, 
							which: 13, 
							bubbles: true,
							cancelable: true
						});
						searchInput.dispatchEvent(keypressEvent);
						
						return true;
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