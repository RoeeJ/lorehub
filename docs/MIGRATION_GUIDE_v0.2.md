# LoreHub v0.2.x Migration Guide

This guide helps you migrate from LoreHub v0.1.x to v0.2.x, which introduces new terminology. Note: v0.2.1 has removed all backward compatibility - this is a breaking change.

## Overview of Changes

LoreHub v0.2.x embraces a more thematic terminology that better reflects the tool's purpose of capturing and preserving the collective wisdom of your codebase.

### Terminology Changes

| Old Term (v0.1.x) | New Term (v0.2.x) | Description |
|-------------------|-------------------|-------------|
| Facts | Lores | Pieces of wisdom and knowledge |
| Projects | Realms | Your codebases and repositories |
| Decisions | Decrees | Architectural and technical choices |
| Todos | Quests | Future actions and tasks |
| Learnings | Lessons | Discoveries and insights |
| Services | Provinces | Monorepo services/modules |
| Tags | Sigils | Categorization tags |
| Active | Living | Current operating knowledge |
| Deprecated | Ancient | Outdated but historically important |

## Command Changes

**Important:** In v0.2.1, some commands have been updated:
- `search` and `list` commands have been replaced by the unified `browse` command
- `project` has been renamed to `realm`
- All terminology has been updated throughout

### Command Changes in v0.2.1

```bash
# v0.1.x (old commands)
lh list --type decision
lh search "auth*"
lh project

# v0.2.1 (new commands)
lh browse --type decree
lh browse "auth*"
lh realm
```

### Migration Examples

| Old Command | New Command |
|-------------|-------------|
| `lh list` | `lh browse` |
| `lh search "query"` | `lh browse "query"` |
| `lh list --type decision` | `lh browse --type decree` |
| `lh project` | `lh realm` |
| Facts in output | Lores in output |
| Project info | Realm info |
| Services filter | Provinces filter |

**Breaking Change:** The `search` and `list` commands have been unified into the new `browse` command in v0.2.1.

## Database Migration

**Database Migration in v0.2.1:**

1. The database migration has been completed in v0.2.1
2. Tables have been renamed: facts → lores, projects → realms, relations → lore_relations
3. Type conversions: decision → decree, learning → lesson, todo → quest
4. All backward compatibility has been removed

## API Compatibility

### MCP Integration

The MCP server has been fully updated to new terminology:

```javascript
// Tool names have been updated
await use_mcp_tool("lorehub", "add_lore", {...})     // New name
await use_mcp_tool("lorehub", "search_lores", {...}) // New name

// Field names have been updated
{
  realmId: "api-gateway",     // New field name
  provinceId: "auth-service"  // New field name for services
}
```

### Type Changes (Breaking)

Old type aliases have been removed in v0.2.1:

```typescript
// Old types no longer available
// import { Fact, Project } from 'lorehub';  // ❌ Removed

// Use new types only
import { Lore, Realm } from 'lorehub';    // ✅ Required
```

## Configuration Updates

The configuration file (`~/.lorehub/config.json`) now includes new search features:

```json
{
  "defaultListLimit": 50,
  "defaultSearchMode": "keyword",  // keyword or semantic
  "semanticThreshold": 0.5,
  "embeddingModel": "all-MiniLM-L6-v2"  // Default model
}
```

## New Features in v0.2.x

### 1. Hybrid Search

New `--hybrid` flag combines keyword and semantic search:

```bash
# Keyword search (default)
lh browse "redis"

# Semantic search
lh browse "redis" --semantic

# Hybrid search (new in v0.2.1)
lh browse "redis" --hybrid
```

### 2. Similar Lores Navigation

Press 's' in list view to see similar lores:
- Shows count of similar items (e.g., "10≈")
- Navigate through similar lores
- Press 'b' to go back in navigation history

### 3. Inline Add Command

Add lores directly from command line:

```bash
# Add inline (fixed in v0.2.1)
lh add "Redis chosen for session cache due to sub-50ms requirement"

# Interactive mode
lh add
```

### 4. Alternative Screen Mode

All views now use alternative screen mode for cleaner terminal experience.

## Breaking Changes

### For CLI Users (Breaking Changes)

- **Removed Commands**: `search` and `list` have been removed
- **New Command**: `browse` replaces both `search` and `list`
- **Renamed Command**: `realm` replaces the old `project` command
- **Updated Output**: All output uses new terminology (lores, realms, etc.)

### For Direct Database Users

If you directly query the SQLite database:
- **Breaking**: Table names have changed in v0.2.1
- `facts` table is now `lores`
- `projects` table is now `realms`
- `relations` table is now `lore_relations`
- Column names remain the same

### For MCP Tool Developers

- Tool names have been updated (search_facts → search_lores, etc.)
- Response formats unchanged
- Field names have been updated to match new terminology

## Migration Checklist

- [ ] Update to LoreHub v0.2.x: `npm update -g lorehub`
- [ ] Database has been migrated to new table names
- [ ] Update any scripts to use new terminology (optional)
- [ ] Configure new features in `~/.lorehub/config.json` (optional)
- [ ] Re-generate embeddings if switching models (optional)

## Troubleshooting

### "Table not found" errors

If upgrading from v0.1.x:
1. Run the migration script: `node scripts/migrate-to-lore-terminology.js`
2. This will rename tables and update type values

### Search not finding results

Try using the hybrid search flag:
```bash
lh browse "your query" --hybrid
```

### Performance issues

Restart the application or check your embedding configuration:
```bash
lh migrate-embeddings
```

## Getting Help

- GitHub Issues: https://github.com/toyamarinyon/lorehub/issues
- Documentation: https://github.com/toyamarinyon/lorehub/docs

## Summary

LoreHub v0.2.1 is a **breaking update** that fully embraces the new fantasy-themed terminology. All backward compatibility has been removed. You must update your scripts and integrations to use the new commands and terminology.