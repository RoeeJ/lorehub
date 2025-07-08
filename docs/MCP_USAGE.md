# LoreHub MCP Integration Guide

This guide explains how to integrate LoreHub with Claude and Cursor to make your AI assistant aware of your project knowledge.

## What is MCP?

Model Context Protocol (MCP) is a standard protocol that allows AI assistants like Claude to interact with external tools. LoreHub implements an MCP server that gives your AI assistant access to all the facts you've recorded about your projects.

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

Once configured, your AI assistant can access your project knowledge using these tools:

### search_facts
Search for facts across all your projects:
```
"Search for facts about database decisions"
"Find all facts related to Redis"
"What decisions have been made about authentication?"
```

### list_facts
List facts with various filters:
```
"List all architectural decisions"
"Show me the latest facts from this project"
"List high-confidence learnings"
```

### get_fact
Get detailed information about a specific fact:
```
"Get details about fact fact-123"
"Show me the full context of that decision"
```

### list_projects
See all projects in your knowledge base:
```
"What projects are in my knowledge base?"
"List all projects with facts"
```

## Example Prompts

Here are some example prompts to use with your AI assistant:

1. **Architecture Review**:
   ```
   "Search for all architectural decisions in this project and summarize the key patterns we're following"
   ```

2. **Onboarding New Team Members**:
   ```
   "List all high-confidence decisions and learnings for the authentication service"
   ```

3. **Technical Debt Review**:
   ```
   "Find all TODO facts and risks recorded in the project"
   ```

4. **Decision History**:
   ```
   "Show me the evolution of our caching strategy by searching for facts about caching ordered by date"
   ```

5. **Cross-Project Learning**:
   ```
   "Search across all projects for facts about performance optimization"
   ```

## Best Practices

1. **Record Context**: When adding facts, include the "why" to give AI assistants better context
2. **Use Consistent Tags**: Tag facts consistently (e.g., "performance", "security", "architecture")
3. **Service Attribution**: For monorepos, always specify which service a fact relates to
4. **Confidence Levels**: Set appropriate confidence levels so AI can weigh information appropriately
5. **Regular Updates**: Keep facts current by marking outdated ones as deprecated

## Troubleshooting

### MCP Server Not Found
If Claude/Cursor can't find the MCP server:
1. Verify the installation path: `npm list -g lorehub`
2. Check that the MCP index file exists: `ls -la /path/to/lorehub/dist/mcp/index.js`
3. Ensure the file is executable: `chmod +x /path/to/lorehub/dist/mcp/index.js`

### No Facts Returned
If queries return no results:
1. Verify facts exist: `lh list`
2. Check the database location: `~/.lorehub/lorehub.db`
3. Try broader search terms or use wildcards: `*cache*`

### Permission Errors
If you get permission errors:
1. Check database file permissions: `ls -la ~/.lorehub/`
2. Ensure the MCP server has read access to the database

## Advanced Usage

### Filtering by Project
MCP tools can filter by specific projects:
```
"Search for facts about caching in the api project"
"List decisions from /Users/me/projects/webapp"
```

### Using Wildcards
The search supports wildcards:
- `*` matches any characters
- `?` matches a single character

Example: "Search for facts matching 'Redis*cache'"

### Combining with AI Analysis
Ask your AI to analyze patterns:
```
"Search for all performance-related facts and identify common bottlenecks"
"List all risks and suggest mitigation strategies based on our decisions"
```

## Security Considerations

- The MCP server has read-only access to your facts
- It cannot modify or delete facts
- It only accesses the local SQLite database
- No data is sent to external services

## Integration with Development Workflow

1. **Before Code Reviews**: "List recent decisions that might affect this PR"
2. **During Planning**: "Search for similar problems we've solved before"
3. **Architecture Decisions**: "Find all facts related to this architectural pattern"
4. **Debugging**: "Search for learnings about this error or issue"

Remember: The more facts you record, the more valuable your AI assistant becomes!