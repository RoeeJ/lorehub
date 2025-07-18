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
Can you list all realms in my LoreHub database?
```

Claude should use the `list_realms` tool and show your realms.

## Available Tools

- **search_lores** - Search with wildcards (* and ?)
  ```
  "Find all database decrees"
  "Search for *cache* lores"
  ```

- **list_lores** - List lores with filters
  ```
  "Show me all constraints for this realm"
  "List recent lessons"
  ```

- **get_lore** - Get specific lore details
  ```
  "Get details for lore ID lore-123"
  ```

- **list_realms** - See all realms
  ```
  "What realms are in LoreHub?"
  ```

## Common Commands

### For Development
```
"What database did we choose and why?"
"Are there any constraints about adding new provinces?"
"What lessons have we learned about performance issues?"
"Search for all authentication-related decrees"
```

### For Code Review
```
"Check if this approach aligns with our architecture decrees"
"Find any constraints related to this feature"
"What past lessons apply to this change?"
```

### For Planning
```
"What are all the decrees for the API province?"
"List all quests for this realm"
"What assumptions have we made about scaling?"
```

## Troubleshooting

### Tools not showing?
1. Check JSON syntax is valid
2. Restart Claude Desktop (quit and reopen)
3. Try running `lorehub-mcp` in terminal to check for errors

### No lores found?
1. Make sure you have lores in your database:
   ```bash
   lh list
   ```
2. Check the realm path matches your current realm

## Next Steps

- Read the full [MCP Integration Guide](./MCP_INTEGRATION.md)
- Start capturing lores: `lh add`
- Configure your IDE (Cursor, VS Code + Continue)