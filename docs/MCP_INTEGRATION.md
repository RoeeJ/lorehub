# LoreHub MCP Integration Guide

This guide explains how to connect LoreHub to various AI assistants using the Model Context Protocol (MCP).

## Table of Contents
- [Installation](#installation)
- [Claude Desktop Setup](#claude-desktop-setup)
- [Cursor IDE Setup](#cursor-ide-setup)
- [Continue Extension Setup](#continue-extension-setup)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

## Installation

First, ensure LoreHub is installed and accessible:

```bash
# Install globally
npm install -g lorehub

# Or clone and link locally
git clone https://github.com/yourusername/lorehub.git
cd lorehub
npm install
npm run build
npm link
```

Verify the installation:
```bash
# Check CLI works
lh --version

# Check MCP server works
lorehub-mcp
```

## Claude Desktop Setup

Claude Desktop supports MCP servers for enhanced capabilities. Here's how to configure LoreHub:

### 1. Locate Claude Desktop Configuration

The configuration file location varies by OS:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 2. Edit Configuration

Add LoreHub to the `mcpServers` section:

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

If you installed locally, use the full path:

```json
{
  "mcpServers": {
    "lorehub": {
      "command": "/path/to/lorehub/dist/mcp/index.js",
      "args": [],
      "env": {}
    }
  }
}
```

### 3. Restart Claude Desktop

After saving the configuration, restart Claude Desktop. You should see LoreHub tools available when you type `/` in the chat.

## Cursor IDE Setup

Cursor supports MCP through its AI features. Configure it in your workspace:

### 1. Create `.cursorrules` file

In your project root, create a `.cursorrules` file:

```
When working in this project, you have access to LoreHub for querying project knowledge.

Available LoreHub commands:
- Use search_facts to find relevant decisions, constraints, or learnings
- Use list_facts to browse all facts for the current project
- Use get_fact to retrieve specific fact details
- Use list_projects to see all projects in the knowledge base

Project path for this workspace: ${workspaceFolder}

Before making architectural decisions or significant changes, search for existing facts:
- Search for related decisions: search_facts(query: "architecture", project_path: "${workspaceFolder}")
- Check constraints: search_facts(query: "constraint", type: "constraint", project_path: "${workspaceFolder}")
- Review past learnings: search_facts(query: "*", type: "learning", project_path: "${workspaceFolder}")
```

### 2. Configure Cursor Settings

Add to your Cursor settings (`.cursor/settings.json`):

```json
{
  "ai.mcpServers": {
    "lorehub": {
      "command": "lorehub-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

## Continue Extension Setup

For VS Code with the Continue extension:

### 1. Edit Continue Configuration

Open `~/.continue/config.json` and add:

```json
{
  "models": [
    // Your existing models...
  ],
  "mcpServers": [
    {
      "name": "lorehub",
      "command": "lorehub-mcp",
      "args": [],
      "description": "Access project knowledge and decisions"
    }
  ],
  "systemMessage": "You have access to LoreHub for querying project knowledge. Use search_facts, list_facts, get_fact, and list_projects tools to find relevant information before making suggestions."
}
```

### 2. Restart VS Code

Restart VS Code for the changes to take effect.

## Usage Examples

Once configured, you can use LoreHub in your AI conversations.

**Note**: LoreHub operates as a global knowledge hub - by default, all searches and lists include facts from ALL your projects. This helps you leverage learnings and decisions across your entire codebase. Facts from your current project are prioritized in results.

### Example 1: Searching for Decisions Across All Projects

```
User: What databases have we decided to use across our projects?

AI: I'll search for database-related decisions across all your projects.

[Calls search_facts with query: "database"]

I found database decisions from 3 projects:
- **api-service**: PostgreSQL for ACID compliance
- **analytics-service**: ClickHouse for time-series data
- **cache-service**: Redis for session storage

Would you like details about any specific project's database choice?
```

### Example 2: Checking Constraints for Current Project

```
User: Can we add a new microservice for user authentication in this project?

AI: Let me check constraints across all projects, focusing on authentication and microservices.

[Calls search_facts with query: "microservice", type: "constraint"]
[Calls search_facts with query: "authentication"]

I found relevant constraints from multiple projects:
- **platform** (your current project): All new microservices must be approved by architecture team
- **auth-service**: Must use existing SSO service, no custom authentication
- **api-gateway**: Authentication must be handled at gateway level

These constraints apply across your organization. Would you like me to find the SSO integration details?
```

### Example 3: Learning from Past Issues

```
User: We're seeing slow query performance. Any past learnings about this?

AI: I'll search for performance-related learnings from your project history.

[Calls search_facts with query: "performance", type: "learning", project_path: "/current/project"]
[Calls search_facts with query: "slow query", type: "learning", project_path: "/current/project"]

Found several relevant learnings:
1. "Always add indexes on foreign key columns" - learned after a 10x performance improvement
2. "Use connection pooling with minimum 10 connections" - resolved timeout issues
3. "Avoid N+1 queries by using eager loading" - reduced API response time by 50%
```

### Example 4: AI-Assisted Code Review

```
User: Review this PR that adds a caching layer.

AI: Let me check for any relevant decisions or constraints about caching.

[Calls search_facts with query: "cache", project_path: "/current/project"]
[Calls search_facts with query: "redis", project_path: "/current/project"]

Based on your project's facts:
- You decided to use Redis for caching (90% confidence)
- There's a constraint: cache TTL must not exceed 1 hour for user data
- Past learning: "Always implement cache warming for critical paths"

The PR looks good but ensure it follows these guidelines.
```

## Troubleshooting

### Common Issues

#### 1. MCP Server Not Starting

```bash
# Check if the command is in PATH
which lorehub-mcp

# Try running directly
node /path/to/lorehub/dist/mcp/index.js

# Check for errors
lorehub-mcp 2>&1 | head -20
```

#### 2. Tools Not Appearing in Claude Desktop

- Ensure the configuration file is valid JSON
- Check that the path to the MCP server is correct
- Restart Claude Desktop completely (not just reload)
- Check logs: `~/Library/Logs/Claude/mcp-server-lorehub.log` (macOS)

#### 3. Database Not Found

```bash
# Ensure database exists
ls -la ~/.lorehub/

# Initialize if needed
lh project init
```

#### 4. Permission Errors

```bash
# Make the MCP server executable
chmod +x $(which lorehub-mcp)

# Or for local installation
chmod +x /path/to/lorehub/dist/mcp/index.js
```

### Debug Mode

To enable debug logging, set the `DEBUG` environment variable:

```json
{
  "mcpServers": {
    "lorehub": {
      "command": "lorehub-mcp",
      "args": [],
      "env": {
        "DEBUG": "lorehub:*"
      }
    }
  }
}
```

### Getting Help

- Check the [LoreHub documentation](https://github.com/yourusername/lorehub)
- Report issues on [GitHub Issues](https://github.com/yourusername/lorehub/issues)
- Join the discussion in [GitHub Discussions](https://github.com/yourusername/lorehub/discussions)

## Best Practices

1. **Regular Fact Capture**: Encourage team members to capture decisions as they're made
2. **Consistent Tagging**: Use consistent tags for better searchability
3. **High-Quality "Why"**: Always include the reasoning behind decisions
4. **Periodic Reviews**: Review and update facts quarterly
5. **AI Integration**: Configure your AI tools to check facts before suggesting changes

## Security Considerations

- LoreHub MCP server has read-only access to your facts database
- It cannot modify or delete facts (use the CLI for that)
- The server runs locally and doesn't send data externally
- Project paths are validated to prevent directory traversal attacks

## Advanced Configuration

### Custom Database Location

```json
{
  "mcpServers": {
    "lorehub": {
      "command": "lorehub-mcp",
      "args": [],
      "env": {
        "LOREHUB_DB_PATH": "/custom/path/to/lorehub.db"
      }
    }
  }
}
```

### Multiple Projects

For different database per project:

```json
{
  "mcpServers": {
    "lorehub-project1": {
      "command": "lorehub-mcp",
      "args": [],
      "env": {
        "LOREHUB_DB_PATH": "/path/to/project1/lorehub.db"
      }
    },
    "lorehub-project2": {
      "command": "lorehub-mcp",
      "args": [],
      "env": {
        "LOREHUB_DB_PATH": "/path/to/project2/lorehub.db"
      }
    }
  }
}
```