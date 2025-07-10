# LoreHub MCP Integration Guide

This guide explains how to integrate LoreHub with Claude and Cursor to make your AI assistant aware of your project knowledge.

## What is MCP?

Model Context Protocol (MCP) is a standard protocol that allows AI assistants like Claude to interact with external tools. LoreHub implements an MCP server that gives your AI assistant access to all the lores you've recorded about your realms.

## Setup for Claude Desktop

### 1. Install LoreHub

First, ensure LoreHub is installed and linked globally:

```bash
npm install -g lorehub
# Or if developing locally:
npm link
```

### 2. Configure Claude Desktop

Edit your Claude Desktop configuration file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Add LoreHub to the `mcpServers` section:

```json
{
  "mcpServers": {
    "lorehub": {
      "command": "node",
      "args": ["/usr/local/lib/node_modules/lorehub/dist/mcp/index.js"],
      "env": {}
    }
  }
}
```

**Note**: Adjust the path if you installed LoreHub elsewhere. You can find the installation path with:
```bash
npm list -g lorehub
```

### 3. Restart Claude Desktop

After saving the configuration, restart Claude Desktop for the changes to take effect.

## Setup for Cursor

### 1. Configure MCP in Cursor

Add the following to your Cursor settings:

```json
{
  "mcp.servers": {
    "lorehub": {
      "command": "node",
      "args": ["/usr/local/lib/node_modules/lorehub/dist/mcp/index.js"]
    }
  }
}
```

## Using LoreHub in AI Conversations

Once configured, your AI assistant can access your realm knowledge using these tools:

### search_lores
Search for lores across all your realms:
```
"Search for lores about database decrees"
"Find all lores related to Redis"
"What decrees have been made about authentication?"
```

### list_lores
List lores with various filters:
```
"List all architectural decrees"
"Show me the latest lores from this realm"
"List high-confidence lessons"
```

### get_lore
Get detailed information about a specific lore:
```
"Get details about lore lore-123"
"Show me the full context of that decree"
```

### list_realms
See all realms in your knowledge base:
```
"What realms are in my knowledge base?"
"List all realms with lores"
```

## Example Prompts

Here are some example prompts to use with your AI assistant:

1. **Architecture Review**:
   ```
   "Search for all architectural decrees in this realm and summarize the key patterns we're following"
   ```

2. **Onboarding New Team Members**:
   ```
   "List all high-confidence decrees and lessons for the authentication service"
   ```

3. **Technical Debt Review**:
   ```
   "Find all quest lores and risks recorded in the realm"
   ```

4. **Decree History**:
   ```
   "Show me the evolution of our caching strategy by searching for lores about caching ordered by date"
   ```

5. **Cross-Realm Learning**:
   ```
   "Search across all realms for lores about performance optimization"
   ```

## Best Practices

1. **Record Context**: When adding lores, include the "why" to give AI assistants better context
2. **Use Consistent Tags**: Tag lores consistently (e.g., "performance", "security", "architecture")
3. **Service Attribution**: For monorepos, always specify which service a lore relates to
4. **Confidence Levels**: Set appropriate confidence levels so AI can weigh information appropriately
5. **Regular Updates**: Keep lores current by marking outdated ones as deprecated

## Troubleshooting

### MCP Server Not Found
If Claude/Cursor can't find the MCP server:
1. Verify the installation path: `npm list -g lorehub`
2. Check that the MCP index file exists: `ls -la /path/to/lorehub/dist/mcp/index.js`
3. Ensure the file is executable: `chmod +x /path/to/lorehub/dist/mcp/index.js`

### No Lores Returned
If queries return no results:
1. Verify lores exist: `lh list`
2. Check the database location: `~/.lorehub/lorehub.db`
3. Try broader search terms or use wildcards: `*cache*`

### Permission Errors
If you get permission errors:
1. Check database file permissions: `ls -la ~/.lorehub/`
2. Ensure the MCP server has read access to the database

## Advanced Usage

### Filtering by Realm
MCP tools can filter by specific realms:
```
"Search for lores about caching in the api realm"
"List decrees from /Users/me/projects/webapp"
```

### Using Wildcards
The search supports wildcards:
- `*` matches any characters
- `?` matches a single character

Example: "Search for lores matching 'Redis*cache'"

### Combining with AI Analysis
Ask your AI to analyze patterns:
```
"Search for all performance-related lores and identify common bottlenecks"
"List all risks and suggest mitigation strategies based on our decrees"
```

## Integration with Development Workflow

1. **Before Code Reviews**: "List recent decrees that might affect this PR"
2. **During Planning**: "Search for similar problems we've solved before"
3. **Architecture Decrees**: "Find all lores related to this architectural pattern"
4. **Debugging**: "Search for lessons about this error or issue"

Remember: The more lores you record, the more valuable your AI assistant becomes!