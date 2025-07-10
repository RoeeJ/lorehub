# LoreHub

> Capture and surface the collective wisdom of your codebase

LoreHub is a Model Context Protocol (MCP) server that helps development teams track decisions, patterns, and lessons learned across multiple realms. It automatically captures important technical decisions from git commits and LLM conversations, making them discoverable when you need them most.

## Why LoreHub?

Ever wondered:
- "Why did we choose Redis over PostgreSQL for caching?"
- "What was that gotcha with Kubernetes deployments in the auth province?"
- "How did we solve this problem in another province?"

LoreHub remembers so you don't have to.

## Features

- 🧠 **Smart Capture**: Automatically detects and captures decisions from git commits and LLM conversations
- 🔍 **Natural Language Search**: Ask questions in plain English with vim-style filtering
- 🏗️ **Monorepo Aware**: Track decisions across 70+ provinces in a single repository
- 🔗 **Relationship Tracking**: Understand how decisions evolve over time
- ⚡ **Local First**: Everything runs on your machine, no external dependencies
- 🤖 **LLM Integration**: Works seamlessly with Claude and other MCP-compatible tools
- 📊 **Grid Layout UI**: Consistent, fixed-height terminal UI with keyboard shortcuts
- 💾 **Export/Import**: Backup and share your knowledge base in JSON or Markdown
- 🔄 **Semantic Search**: AI-powered semantic search for finding conceptually similar lores
- 🎯 **Similar Lores Navigation**: Explore related lores with smart similarity detection

## New in v0.2.1

### The Great Terminology Pivot

LoreHub has evolved! We've embraced a more thematic terminology that better reflects the tool's purpose of capturing and preserving the collective wisdom of your codebase:

- **Facts → Lores**: Pieces of wisdom and knowledge
- **Projects → Realms**: Your codebases and repositories
- **Decisions → Decrees**: Architectural and technical choices
- **Todos → Quests**: Future actions and tasks
- **Learnings → Lessons**: Discoveries and insights
- **Services → Provinces**: Monorepo modules
- **Tags → Sigils**: Categorization markers

### Major Features

- **Unified Browse Command**: Single powerful interface with virtual scrolling for exploring lores
- **Configurable Embedding Models**: Switch between different transformer models (all-mpnet-base-v2, all-MiniLM-L6-v2, etc.)
- **Persistent Configuration**: Settings stored in ~/.lorehub/config.json
- **Auto-updating Search**: Real-time search with 300ms debounce as you type
- **In-app Lore Details**: View full lore details without exiting (press Enter)
- **Similar Lores Navigation**: Press 's' to explore similar lores, 'b' to go back
- **Search Mode Switching**: Toggle between literal, semantic, and hybrid search with 'm'
- **Alternative Screen Mode**: Clean terminal experience that preserves your scroll history
- **Improved Semantic Search**: Better threshold handling for more accurate results
- **Type-safe Database Layer**: Removed all `any` usage for better reliability

### Keyboard Shortcuts

In browse view:
- `↑↓` - Navigate lores
- `s` - Show similar lores
- `b` - Go back (in similar lores view)
- `/` - Filter current lores
- `d` - Delete (archive) lore
- `?` - Show help
- `q` or `ESC` - Quit

## Quick Start

### Installation

```bash
npm install -g lorehub
```

### Basic Usage

```bash
# Launch interactive lores view (default)
lh

# Add a lore interactively (with alternative screen UI)
lh add

# Add a lore inline (quick, non-interactive)
lh add "Decided to use JWT tokens with 1hr expiry for stateless auth"

# Browse and search interactively (recommended)
lh browse
lh b  # Short alias

# Browse with filters
lh browse --type decree
lh browse --current  # Only from current realm
lh browse "auth*"  # Start with search query

# Find similar lores
lh similar <lore-id>

# View realm info
lh realm
```

### AI Assistant Integration

LoreHub integrates with AI assistants via MCP. Once configured, ask questions like:
- "What decrees have we made about caching?"
- "Show me all Redis-related lessons"
- "Are there any constraints about adding new provinces?"

See the [MCP section](#ai-assistant-integration-mcp) below for setup.

### Git Integration

LoreHub automatically captures decisions from your commits:

```bash
git commit -m "fix: Switch from JWT to sessions

JWT tokens were getting too large with permissions.
Decided to use Redis-backed sessions instead."
```

## How It Works

LoreHub stores "lores" - pieces of wisdom about your codebase:

```yaml
Lore: "Switched from JWT to sessions using Redis"
Why: "JWT tokens were getting too large with permissions"  
Realm: "api-gateway"
Provinces: ["auth", "user"]
Source: "commit:a3f2b1"
Confidence: 95%
```

These lores are:
- **Immutable**: Never deleted, only superseded
- **Linked**: Related lores connect to show evolution
- **Searchable**: Full-text search across all content
- **Contextual**: Tied to specific realms and provinces

## Monorepo Support

Perfect for large codebases with many provinces:

```bash
# Lores are automatically tagged with provinces
/monorepo/provinces/auth/main.go → tagged: "auth"
/monorepo/provinces/user/api.ts → tagged: "user"

# Cross-province insights
"Show me all authentication patterns across provinces"
"Which provinces use Kafka vs RabbitMQ?"
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

### Complete MCP Tools Reference

- **search_lores** - Search with wildcards and filters
- **list_lores** - Browse lores by type or province
- **get_lore** - Retrieve specific lore details
- **list_realms** - See all tracked realms
- **create_lore** - Create new lores programmatically
- **update_lore** - Update existing lore properties
- **delete_lore** - Permanently delete lores
- **archive_lore** - Soft delete (archive) lores
- **restore_lore** - Restore archived lores
- **create_relation** - Link related lores
- **delete_relation** - Remove lore relationships
- **list_relations** - View lore relationships
- **get_realm_stats** - Get realm statistics
- **semantic_search_lores** - AI-powered semantic search
- **find_similar_lores** - Find lores similar to a given lore

### Example Usage in AI Conversations

```
"What database did we decree to use?"
"Show me all performance-related lessons"
"Are there constraints about adding new services?"
"Find all Redis-related decrees"
```

See [MCP Usage Guide](docs/MCP_USAGE.md) for detailed setup instructions, example prompts, and troubleshooting.

## CLI Reference

```bash
# Adding lores
lh add                            # Interactive mode (with Ink UI)
lh add "Chose PostgreSQL for ACID compliance"  # Inline mode

# Searching & Listing
lh search "database*"             # Search with wildcards
lh search "auth" --type=decree    # Filter by type
lh list                           # Interactive list view
lh list --limit=10                # Show last 10 lores
lh list --current                 # Only from current realm

# Realm Management
lh realm                          # Show current realm info

# Export & Import
lh export lores.json              # Export all lores as JSON
lh export lores.md --format markdown  # Export as Markdown
lh export realm.json -p /path     # Export specific realm only
lh import lores.json              # Import (replaces existing)
lh import lores.json --merge      # Merge with existing data
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

## Realm Status

LoreHub is in active development. Current focus:
- [x] Core data model with SQLite
- [x] Interactive CLI with Ink UI  
- [x] MCP server implementation
- [x] Wildcard search support
- [x] Export/import functionality
- [x] Grid-based UI with keyboard shortcuts
- [x] Lore relationships (via MCP)
- [x] Semantic search with embeddings
- [x] Similar lores navigation
- [ ] Git integration
- [ ] Time-based query syntax
- [ ] Configuration file support

## Contributing

This started as a personal realm to solve my own pain points managing 70+ microservices. If you find it useful, contributions are welcome!

## License

MIT

---

Built with ❤️ by [Roee](https://github.com/roeej)