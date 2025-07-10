# Quick Fixes Needed

## 1. Inline Add Command Fix

**File**: `src/cli/commands/add.tsx`

**Current Issue**: 
```typescript
// Currently always renders interactive UI
export async function renderAddLore(options: AddLoreOptions) {
  const { waitUntilExit } = render(
    <AddFact 
      db={db} 
      projectPath={process.cwd()}
      // ...
    />
  );
```

**Fix Needed**:
```typescript
export async function renderAddLore(options: AddLoreOptions) {
  // If content provided inline, skip interactive UI
  if (options.initialContent && process.argv.includes('add') && process.argv.length > 3) {
    // Direct creation logic
    const loreInput = {
      realmId: realm.id,
      content: options.initialContent,
      type: options.type || 'decision',
      // ... other options
    };
    
    const lore = await db.createLore(loreInput);
    console.log(`✓ Lore created: ${lore.id}`);
    return;
  }
  
  // Otherwise use interactive UI
  const { waitUntilExit } = render(...);
}
```

## 2. AddLore Alternative Screen

**File**: `src/cli/components/AddLore.tsx`

**Changes Needed**:
1. Import AlternativeScreenView
2. Wrap main return in AlternativeScreenView
3. Update layout to use full terminal dimensions

```typescript
import { AlternativeScreenView } from './AlternativeScreenView.js';
import { useTerminalDimensions } from '../hooks/useTerminalDimensions.js';

// In component:
const { columns, rows } = useTerminalDimensions();

// Wrap return:
return (
  <AlternativeScreenView>
    <Box flexDirection="column" height={rows - 1}>
      {/* existing content */}
    </Box>
  </AlternativeScreenView>
);
```

## 3. README MCP Tools Update

**File**: `README.md`

Add after line 137:

```markdown
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
```

## 4. README New Features Section

Add new section after line 25:

```markdown
## New in v0.2.0

- **Similar Lores Navigation**: See count of similar lores (e.g., "10≈") and press 's' to explore them
- **Recursive Navigation**: Dive deep into similar lores with navigation history ('b' to go back)
- **Alternative Screen Mode**: Clean terminal experience that preserves your scroll history
- **Dynamic Layout**: Automatically adjusts to your terminal size
- **Semantic Search**: Use `--semantic` flag for AI-powered search
- **Fixed-width Display**: Predictable, aligned layout with bullet points instead of emojis

### Keyboard Shortcuts

In list/search view:
- `↑↓` - Navigate lores
- `s` - Show similar lores
- `b` - Go back (in similar lores view)
- `/` - Filter current list
- `d` - Delete (archive) lore
- `?` - Show help
- `q` or `ESC` - Quit
```

## 5. Update Project Status

**File**: `README.md` (around line 200)

```markdown
## Project Status

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
```