export function getWebSearchDescription(): string {
	return `## web_search
Description: Perform intelligent web search using a list of keywords on different platforms. This tool searches the internet for content relevant to the provided keywords and returns search results. Each result includes the title, URL, snippet, and domain. If you want to adjust the content, modify the keywords list, page limit, or search platform.
Parameters:
- keyword_list: (required) List of search keywords separated by commas. Maximum 4 keywords allowed. Order doesn't matter.
- page_limit: (optional) Number of result pages to fetch, each page contains about 10 results. Default is 1, maximum is 10.
- search_on: (optional) Search platform. Valid values: 'general', 'xiaohongshu', 'zhihu', 'weibo'. Default is 'general'.
  - 'general': Use general search engines (Bing, Baidu, Sogou, DuckDuckGo)
  - 'xiaohongshu': Search on XiaoHongShu (Little Red Book) platform
  - 'zhihu': Search on Zhihu platform  
  - 'weibo': Search on Weibo platform
Usage:
<web_search>
<keyword_list>javascript, tutorial, beginners</keyword_list>
<page_limit>2</page_limit>
<search_on>general</search_on>
</web_search>

Behavior:
1. Validates that keyword_list contains 1-4 keywords (less than 5)
2. Filters out empty keywords
3. Validates page_limit (1-10, defaults to 1)
4. Validates search_on platform (defaults to 'general')
5. Performs intelligent search using the specified platform
6. Returns search results with title, URL, snippet, and domain
7. Results are limited based on page_limit (about 10 results per page)
8. Results are sorted by relevance

Examples:

1. Basic search with general search engine:
<web_search>
<keyword_list>python, machine learning, tutorial</keyword_list>
</web_search>

2. Search on XiaoHongShu platform with page limit:
<web_search>
<keyword_list>美食, 推荐</keyword_list>
<page_limit>3</page_limit>
<search_on>xiaohongshu</search_on>
</web_search>

3. Search on Zhihu platform:
<web_search>
<keyword_list>人工智能, 发展前景</keyword_list>
<page_limit>2</page_limit>
<search_on>zhihu</search_on>
</web_search>

4. Search on Weibo platform:
<web_search>
<keyword_list>热点新闻</keyword_list>
<page_limit>1</page_limit>
<search_on>weibo</search_on>
</web_search>

5. Search with single keyword on general platform:
<web_search>
<keyword_list>typescript</keyword_list>
<page_limit>1</page_limit>
<search_on>general</search_on>
</web_search>

Output Format:
The tool returns a JSON object containing:
- keywords: Array of search keywords used
- page_limit: Number of pages searched
- search_on: Platform used for searching
- total_results: Number of results found
- results: Array of search results, where each result contains:
  - rank: Result ranking (1-based)
  - title: The title of the web page
  - url: The full URL of the web page
  - snippet: A brief description or excerpt from the page
  - domain: The domain name of the website

Note: 
- Keywords should be relevant and specific for better search results
- Keyword is a single word or phrase, not a sentence. For example, "javascript tutorial" is not a single keyword, but "javascript" and "tutorial" are two single keywords.So if you want to search for "javascript tutorial", you should use "javascript" and "tutorial" as two keywords.like this:
<web_search>
<keyword_list>javascript, tutorial</keyword_list>
<page_limit>1</page_limit>
<search_on>general</search_on>
</web_search>
- Maximum 4 keywords are allowed (length < 5)
- Empty or whitespace-only keywords are automatically filtered out
- Page limit is capped at 10 pages maximum
- Different platforms may return different types of content:
  - General: Web pages from search engines
  - XiaoHongShu: User posts and notes
  - Zhihu: Questions and answers
  - Weibo: Social media posts
- To get different results, modify the keywords, page limit, or search platform in your query`
} 