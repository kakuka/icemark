import { BaseSearchEngineConfig } from "./base_search_engine_config"

/**
 * Bing搜索配置
 */
export class BingConfig {
	static getConfig(): BaseSearchEngineConfig {
		return new BaseSearchEngineConfig({
			// 重写必需字段
			name: 'bing_search',
			homepageUrl: 'https://www.bing.com/',
			
			// 重写可选字段
			cookieDomain: 'bing.com',
			
			// 自定义HTTP请求头
		//   customHeaders: {
		//     'X-Forwarded-For': '8.8.8.8'
		//   },
			
		//   // 自定义HTTP请求头应用的URL模式
		//   headerUrlPattern: '*://www.bing.com/*',
			
			// 重写JavaScript代码
			inputAndSubmitJs: `
				(() => {
					const searchInput = document.getElementById('sb_form_q');
					if (searchInput && searchInput.offsetParent !== null) { // Check visibility
						searchInput.value = '${BaseSearchEngineConfig.PLACEHOLDERS.QUERY}';
						const form = document.getElementById('sb_form');
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
					return currentURL.includes('bing.com/search');
				})()
			`,
			
			extractResultsJs: `
				(() => {
					const results = [];
					const resultSelectors = ['#b_results .b_algo', '#b_results li.b_ans', '#b_results .b_rich', '#b_results .b_rs'];
					let allElements = [];
					resultSelectors.forEach(selector => {
						document.querySelectorAll(selector).forEach(el => allElements.push(el));
					});
					const uniqueElements = Array.from(new Set(allElements));

					uniqueElements.forEach(element => {
						try {
							const titleSelectors = ['h2 a', '.b_title a', '.b_topTitle a', '.b_focusTextLarge', 'a.cbtn', 'a.b_restorableLink', '.b_topTitleText a'];
							let titleElement = null;
							for (let selector of titleSelectors) { titleElement = element.querySelector(selector); if (titleElement) break; }
							
							const descSelectors = ['.b_caption p', '.b_snippet', '.b_sideBleed', '.b_richcard', '.b_vlist2col', '.b_factrow', '.b_descriptionText', '.tab-content', '.b_hide', '.b_caption', '.b_pag', 'p', '.b_paractl'];
							let descElement = null;
							for (let selector of descSelectors) { descElement = element.querySelector(selector); if (descElement) break; }
							
							let url = '';
							if (titleElement && titleElement.href) {
								url = titleElement.href;
							} else {
								const linkElement = element.querySelector('a[href]');
								if (linkElement) url = linkElement.href;
							}
							
							// 处理Bing跳转链接，提取真实URL
							if (url && url.includes('bing.com/ck/a?')) {
								try {
									const urlObj = new URL(url);
									const redirectUrl = urlObj.searchParams.get('u');
									if (redirectUrl) {
										// Bing的u参数通常以a1开头，后面是base64编码的URL
										let decodedUrl = redirectUrl;
										if (redirectUrl.startsWith('a1')) {
											// 去掉a1前缀，对剩余部分进行base64解码
											const base64Part = redirectUrl.substring(2);
											try {
												decodedUrl = atob(base64Part);
												// 解码后可能还需要URI解码
												decodedUrl = decodeURIComponent(decodedUrl);
											} catch (e) {
												console.warn('Base64 decode failed, using original redirect URL');
												decodedUrl = decodeURIComponent(redirectUrl);
											}
										} else {
											decodedUrl = decodeURIComponent(redirectUrl);
										}
										url = decodedUrl;
									}
								} catch (e) {
									console.warn('URL cleanup error:', e);
									// 如果解析失败，保留原始链接
								}
							}
							
							const title = titleElement ? titleElement.textContent.trim() : '无标题';
							let description = '无描述';
							if (descElement) {
								description = descElement.innerText.trim() || descElement.textContent.trim();
								if (description.length > 300) description = description.substring(0, 297) + '...';
							} else {
								const allText = element.innerText.trim();
								if (allText && allText !== title) {
									let remainingText = allText.replace(title, '').trim();
									if (remainingText.length > 300) description = remainingText.substring(0, 297) + '...';
									else if (remainingText.length > 0) description = remainingText;
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
					const pagNav = document.querySelector('#b_results > li.b_pag > nav > ul');
					if (pagNav && pagNav.children.length > 0) {
						const lastLi = pagNav.children[pagNav.children.length - 1];
						if (lastLi && lastLi.tagName === 'LI') {
							const nextPageButton = lastLi.querySelector('a');
							if (nextPageButton && nextPageButton.offsetParent !== null) {
								console.log('[BingConfig] Found next page button:', nextPageButton.outerHTML);
								nextPageButton.click();
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