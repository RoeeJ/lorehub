# LoreHub Complete Reference

## Overview

LoreHub is a Model Context Protocol (MCP) server that helps development teams track decisions, patterns, and lessons learned across multiple codebases (realms). It automatically captures important technical decisions from git commits and LLM conversations, making them discoverable when you need them most.

## Installation

```bash
# Install globally
npm install -g lorehub

# Or use with npx
npx lorehub
```

## Core Concepts

### Terminology

| Term | Description |
|------|-------------|
| **Lore** | A piece of wisdom, knowledge, or decision about your codebase |
| **Realm** | A codebase or repository being tracked |
| **Province** | A service/module within a monorepo |
| **Sigil** | A tag for categorizing lores |
| **Decree** | An architectural or technical decision |
| **Quest** | A future action or task |
| **Lesson** | Something learned from experience |
| **Living** | Active, current knowledge |
| **Ancient** | Outdated but historically important |
| **Archived** | Soft-deleted lores |

### Lore Types

- **decree** - Architectural or technical choice
- **wisdom** - Something discovered or learned
- **belief** - Unverified belief or hypothesis
- **constraint** - Limitation or restriction
- **requirement** - Business or technical requirement
- **risk** - Potential problem or concern
- **quest** - Future action needed
- **saga** - Major initiative that will generate many lores
- **story** - User story
- **anomaly** - Bug or issue
- **other** - Miscellaneous lore

### Lore Status

- **living** - Active and current
- **ancient** - Outdated but kept for history
- **whispered** - Uncertain or unverified
- **proclaimed** - Officially documented
- **archived** - Soft deleted

## CLI Commands

### lh (or lorehub)

The main command. Running without arguments shows help.

```bash
lh --help
lh --version
```

### lh add

Add a new lore to the current realm.

**Interactive Mode:**

```bash
lh add
```

Opens a conversational UI with:

- 📝 Content prompt
- 📂 Type selection
- ✨ Confidence adjustment (0-100%)

**Inline Mode:**

```bash
lh add "Content of the lore"
lh add "Decided to use Redis for session storage" --type decree
lh add "User auth tokens expire after 1 hour" --confidence 95
```

**Options:**

- `--type <type>` - Lore type (decree, wisdom, belief, etc.)
- `--confidence <number>` - Confidence level (0-100, default: 80)
- `--why <reason>` - Additional context
- `--provinces <list>` - Comma-separated provinces
- `--sigils <list>` - Comma-separated sigils

### lh browse

Interactive lore browser with search and filtering.

```bash
lh browse
lh browse --realm /path/to/realm
lh browse --current  # Current realm only
```

**Interactive Controls:**

- `↑/↓` or `j/k` - Navigate
- `/` - Filter (literal search)
- `m` - Switch search mode (literal/semantic/hybrid)
- `d` - Delete selected lore
- `s` - View similar lores
- `?` - Show help
- `q` or `Esc` - Quit

**Search Modes:**

- **literal** - Substring matching
- **semantic** - AI-powered conceptual search
- **hybrid** - Combined literal and semantic (best results)

### lh search

Search for lores across all realms.

```bash
lh search "redis"
lh search "cache*"  # Wildcard search
lh search "database decision" --semantic
lh search "auth" --type decree
lh search "payment" --province billing
lh search "security" --realm /path/to/project
lh search "api" --current  # Current realm only
lh search "performance" --limit 20
```

**Options:**

- `--type <type>` - Filter by lore type
- `--province <name>` - Filter by province
- `--realm <path>` - Search specific realm
- `--current` - Current realm only
- `--limit <n>` - Max results (default: 10)
- `--semantic` - Use semantic search
- `--hybrid` - Use hybrid search

### lh list

List lores with filtering options.

```bash
lh list
lh list --type decree
lh list --province auth
lh list --realm /path/to/project
lh list --current
lh list --limit 50
```

**Options:**

- `--type <type>` - Filter by type
- `--province <name>` - Filter by province
- `--realm <path>` - List from specific realm
- `--current` - Current realm only
- `--limit <n>` - Max results

### lh realm

Show information about realms.

```bash
lh realm  # Current realm info
lh realm stats  # Detailed statistics
lh realm list  # List all realms
```

### lh export

Export lores in various formats.

```bash
lh export  # Export all as JSON
lh export --format md  # Markdown format
lh export --realm /path/to/project
lh export --output backup.json
```

**Options:**

- `--format <json|md>` - Output format (default: json)
- `--realm <path>` - Export specific realm
- `--output <file>` - Output file

### lh import

Import lores from a backup.

```bash
lh import backup.json
lh import --realm /path/to/project data.json
```

**Options:**

- `--realm <path>` - Import to specific realm

### lh delete

Delete (archive) a lore.

```bash
lh delete <lore-id>
lh delete abc-123 --hard  # Permanent deletion
```

**Options:**

- `--hard` - Permanent deletion (cannot be undone)

### lh restore

Restore an archived lore.

```bash
lh restore <lore-id>
```

### lh migrate-embeddings

Generate or regenerate embeddings for semantic search.

```bash
lh migrate-embeddings  # Generate missing embeddings
lh migrate-embeddings --force  # Regenerate all
lh migrate-embeddings --realm /path/to/project
```

**Options:**

- `--force` - Regenerate all embeddings
- `--realm <path>` - Specific realm only

### lh serve-mcp

Start the MCP server for AI assistant integration.

```bash
lh serve-mcp
```

## Configuration

### Environment Variables

- `LOREHUB_DB` - Database file location (default: `~/.lorehub/lorehub.db`)
- `LOREHUB_SEARCH_MODE` - Default search mode (literal/semantic/hybrid)

### Config File

Location: `~/.lorehub/config.json`

```json
{
  "searchMode": "hybrid",
  "semanticSearchThreshold": 0.5,
  "defaultConfidence": 80
}
```

## MCP (Model Context Protocol) Integration

### Available MCP Tools

1. **search_lores** - Search with wildcards and filters
   - Parameters: query, realm_path, type, province, limit

2. **list_lores** - Browse lores with filters
   - Parameters: realm_path, type, province, limit

3. **get_lore** - Get specific lore details
   - Parameters: lore_id

4. **list_realms** - List all tracked realms
   - No parameters

5. **create_lore** - Create new lore
   - Parameters: realm_path, content, type, confidence, why, provinces, sigils

6. **update_lore** - Update existing lore
   - Parameters: lore_id, content, type, confidence, status, why

7. **delete_lore** - Permanently delete lore
   - Parameters: lore_id, confirm

8. **archive_lore** - Soft delete lore
   - Parameters: lore_id

9. **restore_lore** - Restore archived lore
   - Parameters: lore_id

10. **create_relation** - Create relationship between lores
    - Parameters: from_lore_id, to_lore_id, type (supersedes/contradicts/supports/depends_on/relates_to)

11. **delete_relation** - Remove relationship
    - Parameters: from_lore_id, to_lore_id, type

12. **list_relations** - List lore relationships
    - Parameters: lore_id, direction (from/to/both)

13. **get_realm_stats** - Get realm statistics
    - Parameters: realm_path

14. **semantic_search_lores** - Semantic similarity search
    - Parameters: query, realm_path, threshold, limit

15. **find_similar_lores** - Find similar lores
    - Parameters: lore_id, threshold, limit

### Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lorehub": {
      "command": "lorehub-mcp",
      "args": []
    }
  }
}
```

## Database Schema

### Tables

1. **realms** - Tracked codebases
   - id, name, path, gitRemote, isMonorepo, provinces, lastSeen, createdAt

2. **lores** - Knowledge entries
   - id, realmId, content, why, type, provinces, sigils, confidence, origin, status, createdAt, updatedAt

3. **lore_relations** - Relationships between lores
   - id, fromLoreId, toLoreId, type, metadata, strength, createdAt

4. **lores_vec** - Embeddings for semantic search
   - lore_id, embedding

5. **change_log** - Change tracking
   - id, entityType, entityId, realmId, operation, changes, timestamp, syncStatus

## File Structure

```
~/.lorehub/
├── lorehub.db          # SQLite database
├── config.json         # User configuration
└── exports/            # Export directory
```

## Search Features

### Wildcard Search

- `*` - Match any characters
- `?` - Match single character
- Examples: `redis*`, `*cache*`, `auth?`

### Semantic Search

- AI-powered conceptual matching
- Finds related concepts even with different wording
- Example: Searching "authentication" finds "auth", "login", "JWT"

### Hybrid Search

- Combines literal and semantic search
- Best overall results
- Weighted: 30% literal + 70% semantic

## Terminal UI Features

### Browse View

- Split-pane interface (list + details)
- Dynamic sizing based on terminal width
- Keyboard navigation
- Real-time filtering
- Similar lores count indicator

### Add View

- Conversational interface
- Emoji indicators for fields
- Active field highlighting
- Tab navigation between fields
- Confidence adjustment with arrow keys

### Color Coding

- Cyan - Active/selected items
- Green - Success messages
- Red - Errors
- Yellow - Warnings
- Gray - Secondary information

## Best Practices

### Lore Content

- Be specific and actionable
- Include context and reasoning
- Reference specific technologies
- Date important decisions

### Organization

- Use provinces for monorepo modules
- Apply consistent sigils for categorization
- Set appropriate confidence levels
- Update status as lores age

### Search Strategy

1. Start with literal search for exact matches
2. Use semantic search for conceptual queries
3. Use hybrid for best overall results
4. Filter by type/province to narrow results

## Troubleshooting

### Common Issues

1. **"Database locked" errors**
   - Ensure only one LoreHub process is running
   - Check file permissions on ~/.lorehub/

2. **Semantic search not working**
   - Run `lh migrate-embeddings` to generate embeddings
   - Check that sqlite-vec extension is properly installed

3. **MCP connection issues**
   - Verify path in Claude Desktop config
   - Restart Claude Desktop after config changes
   - Check console for error messages

### Debug Commands

```bash
# Check database integrity
sqlite3 ~/.lorehub/lorehub.db "PRAGMA integrity_check;"

# View recent lores
lh list --limit 10

# Test semantic search
lh search "test" --semantic --limit 5

# Verify MCP server
lh serve-mcp  # Should show "MCP server started"
```

## Version History

- **v0.2.2** - Improved UI, fixed semantic search in browse mode
- **v0.2.1** - The Great Terminology Pivot
- **v0.2.0** - Added similar lores navigation, alternative screen mode
- **v0.1.0** - Initial release

## Future Features (Roadmap)

- Git integration for automatic lore extraction
- Team synchronization via git
- Time-based queries ("show me decisions from last month")
- Custom lore types
- Web UI
- Export to documentation sites
- Slack/Discord integration

