export function getSaveResourceDescription(): string {
	return `## save_resource
Description: Save web page content or resource URI to a specified file. This tool first attempts to fetch the actual content from web URLs using MCP tools, then saves either the content or URI to a text file as fallback.
Parameters:
- uri: (required) The resource URI to fetch and save (e.g., web URL, file path, etc.)
- folder: (required) The target folder path (relative to workspace root)
- filename: (required) The name of the file to create
Usage:
<save_resource>
<uri>resource URI here</uri>
<folder>target/folder/path</folder>
<filename>filename.ext</filename>
</save_resource>

Behavior:
1. For web URLs (http/https): Attempts to fetch actual page content using MCP web_page_detail tool
2. If content fetching succeeds: Saves the full web page content to the file
3. If content fetching fails: Falls back to saving the URI string itself
4. For non-web URIs: Saves the URI string directly

Examples:

1. Save web page content:
<save_resource>
<uri>https://example.com/article</uri>
<folder>research</folder>
<filename>article_content.txt</filename>
</save_resource>
This will fetch and save the actual article content, not just the URL.

2. Save API endpoint reference:
<save_resource>
<uri>https://api.example.com/data</uri>
<folder>resources/api</folder>
<filename>data.txt</filename>
</save_resource>

Note: The tool will create the folder structure if it doesn't exist and will ask for confirmation if the target file already exists. Content fetching provides much more value than just saving URLs.`
} 