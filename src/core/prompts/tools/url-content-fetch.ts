export function getUrlContentFetchDescription(): string {
	return `## url_content_fetch
Description: Fetch content from a web URL and convert it to markdown format. This tool launches a headless browser, navigates to the specified URL, and extracts the text content as markdown. It's useful for reading web pages, documentation, articles, and other web-based content. Optionally, you can save the fetched content to a file.
Parameters:
- url: (required) The web URL to fetch content from (must be a valid HTTP/HTTPS URL)
- save_to_file_full_path: (optional) Full path where to save the fetched markdown content (includes both folder and filename)
Usage:
<url_content_fetch>
<url>https://example.com/page</url>
<save_to_file_full_path>/path/to/save/content.md</save_to_file_full_path>
</url_content_fetch>

Behavior:
1. Launches a headless browser using Puppeteer
2. Navigates to the specified URL
3. Waits for DOM content to load and network to be idle
4. Extracts the HTML content
5. Removes unnecessary elements (scripts, styles, nav, footer, header)
6. Converts the cleaned HTML to markdown format
7. Returns the markdown content
8. If save_to_file_full_path is provided, saves the content to the specified file

Examples:

1. Fetch and return content only:
<url_content_fetch>
<url>https://docs.example.com/api-reference</url>
</url_content_fetch>

2. Fetch content and save to file:
<url_content_fetch>
<url>https://blog.example.com/latest-news</url>
<save_to_file_full_path>/path/to/save/content_name.md</save_to_file_full_path>
</url_content_fetch>


Note: This tool requires an active internet connection and may take some time to load complex pages. The browser will be automatically managed (launched and closed) during the operation. Only HTTP and HTTPS URLs are supported. When saving to file, the tool will create necessary directories if they don't exist.`
} 