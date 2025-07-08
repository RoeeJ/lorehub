# LoreHub MCP Quick Start

## 1-Minute Setup for Claude Desktop

### Step 1: Install LoreHub
```bash
npm install -g lorehub
```

### Step 2: Configure Claude Desktop

1. Open configuration file:
   - macOS: `open ~/Library/Application\ Support/Claude/claude_desktop_config.json`
   - Windows: `notepad %APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `nano ~/.config/Claude/claude_desktop_config.json`

2. Add LoreHub configuration:
```json
{
  "mcpServers": {
    "lorehub": {
      "command": "lorehub-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

3. Restart Claude Desktop

### Step 3: Test It

In Claude Desktop, type:
```
Can you list all projects in my LoreHub database?
```

Claude should use the `list_projects` tool and show your projects.

## Available Tools

- **search_facts** - Search with wildcards (* and ?)
  ```
  "Find all database decisions"
  "Search for *cache* facts"
  ```

- **list_facts** - List facts with filters
  ```
  "Show me all constraints for this project"
  "List recent learnings"
  ```

- **get_fact** - Get specific fact details
  ```
  "Get details for fact ID fact-123"
  ```

- **list_projects** - See all projects
  ```
  "What projects are in LoreHub?"
  ```

## Common Commands

### For Development
```
"What database did we choose and why?"
"Are there any constraints about adding new services?"
"What have we learned about performance issues?"
"Search for all authentication-related decisions"
```

### For Code Review
```
"Check if this approach aligns with our architecture decisions"
"Find any constraints related to this feature"
"What past learnings apply to this change?"
```

### For Planning
```
"What are all the decisions for the API service?"
"List all TODOs for this project"
"What assumptions have we made about scaling?"
```

## Troubleshooting

### Tools not showing?
1. Check JSON syntax is valid
2. Restart Claude Desktop (quit and reopen)
3. Try running `lorehub-mcp` in terminal to check for errors

### No facts found?
1. Make sure you have facts in your database:
   ```bash
   lh list
   ```
2. Check the project path matches your current project

## Next Steps

- Read the full [MCP Integration Guide](./MCP_INTEGRATION.md)
- Start capturing facts: `lh add`
- Configure your IDE (Cursor, VS Code + Continue)