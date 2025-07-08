# LoreHub

> Capture and surface the collective wisdom of your codebase

LoreHub is a Model Context Protocol (MCP) server that helps development teams track decisions, patterns, and lessons learned across multiple projects. It automatically captures important technical decisions from git commits and LLM conversations, making them discoverable when you need them most.

## Why LoreHub?

Ever wondered:
- "Why did we choose Redis over PostgreSQL for caching?"
- "What was that gotcha with Kubernetes deployments in the auth service?"
- "How did we solve this problem in another microservice?"

LoreHub remembers so you don't have to.

## Features

- 🧠 **Smart Capture**: Automatically detects and captures decisions from git commits and LLM conversations
- 🔍 **Natural Language Search**: Ask questions in plain English
- 🏗️ **Monorepo Aware**: Track decisions across 70+ microservices in a single repository
- 🔗 **Relationship Tracking**: Understand how decisions evolve over time
- ⚡ **Local First**: Everything runs on your machine, no external dependencies
- 🤖 **LLM Integration**: Works seamlessly with Claude and other MCP-compatible tools

## Quick Start

### Installation

```bash
npm install -g lorehub
```

### Basic Usage

```bash
# Add a fact interactively
lh add

# Add a fact inline
lh add "Decided to use JWT tokens with 1hr expiry for stateless auth"

# List all facts
lh list

# Search for facts
lh search "auth*"
lh search "database"

# View project info
lh project
```

### AI Assistant Integration

LoreHub integrates with AI assistants via MCP. Once configured, ask questions like:
- "What decisions have we made about caching?"
- "Show me all Redis-related learnings"
- "Are there any constraints about adding new services?"

See the [MCP section](#ai-assistant-integration-mcp) below for setup.

### Git Integration

LoreHub automatically captures decisions from your commits:

```bash
git commit -m "fix: Switch from JWT to sessions

JWT tokens were getting too large with permissions.
Decided to use Redis-backed sessions instead."
```

## How It Works

LoreHub stores "facts" - pieces of wisdom about your codebase:

```yaml
Fact: "Switched from JWT to sessions using Redis"
Why: "JWT tokens were getting too large with permissions"  
Project: "api-gateway"
Services: ["auth-service", "user-service"]
Source: "commit:a3f2b1"
Confidence: 95%
```

These facts are:
- **Immutable**: Never deleted, only superseded
- **Linked**: Related facts connect to show evolution
- **Searchable**: Full-text search across all content
- **Contextual**: Tied to specific projects and services

## Monorepo Support

Perfect for large codebases with many services:

```bash
# Facts are automatically tagged with services
/monorepo/services/auth/main.go → tagged: "auth"
/monorepo/services/user/api.ts → tagged: "user"

# Cross-service insights
"Show me all authentication patterns across services"
"Which services use Kafka vs RabbitMQ?"
```

## AI Assistant Integration (MCP)

LoreHub includes a Model Context Protocol (MCP) server that integrates with Claude Desktop, Cursor, and other AI assistants:

### Quick Setup for Claude Desktop

1. Install LoreHub: `npm install -g lorehub`
2. Add to Claude Desktop config:
   ```json
   {
     "mcpServers": {
       "lorehub": {
         "command": "node",
         "args": ["/usr/local/lib/node_modules/lorehub/dist/mcp/index.js"]
       }
     }
   }
   ```
3. Restart Claude Desktop

### Available MCP Tools

- **search_facts** - Search with wildcards and filters
- **list_facts** - Browse facts by type or service
- **get_fact** - Retrieve specific fact details
- **list_projects** - See all tracked projects

### Example Usage in AI Conversations

```
"What database did we decide to use?"
"Show me all performance-related learnings"
"Are there constraints about adding new services?"
"Find all Redis-related decisions"
```

See [MCP Usage Guide](docs/MCP_USAGE.md) for detailed setup instructions, example prompts, and troubleshooting.

## CLI Reference

```bash
# Adding facts
lh add                            # Interactive mode (with Ink UI)
lh add "Chose PostgreSQL for ACID compliance"  # Inline mode

# Searching & Listing
lh search "database*"             # Search with wildcards
lh search "auth" --type=decision  # Filter by type
lh list                           # Interactive list view
lh list --limit=10                # Show last 10 facts

# Project Management
lh project                        # Show current project info
lh project init                   # Initialize project
```

## Configuration

LoreHub works with zero configuration, but can be customized:

```json
{
  "autoCapture": {
    "enabled": true,
    "requireConfirmation": true
  },
  "git": {
    "parseCommits": true,
    "patterns": ["decided", "switched", "chose"]
  }
}
```

## Project Status

LoreHub is in active development. Current focus:
- [x] Core data model with SQLite
- [x] Interactive CLI with Ink UI
- [x] MCP server implementation
- [x] Wildcard search support
- [ ] Git integration
- [ ] Fact relationships
- [ ] Export/import functionality

## Contributing

This started as a personal project to solve my own pain points managing 70+ microservices. If you find it useful, contributions are welcome!

## License

MIT

---

Built with ❤️ by [Roee](https://github.com/roeej)