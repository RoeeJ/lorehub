# LoreHub Implementation Guide

## Quick Start Development Plan

### Phase 1: Foundation (Week 1)
- [ ] Initialize TypeScript project
- [ ] Set up SQLite with better-sqlite3
- [ ] Create database schema and migrations
- [ ] Basic data models (Lore, Realm, Relation)
- [ ] Core CRUD operations

### Phase 2: CLI (Week 1-2)
- [ ] CLI structure with commander.js
- [ ] Quick capture: `lh "lore text"`
- [ ] Search: `lh ?query`
- [ ] Realm detection (git root)
- [ ] Basic output formatting

### Phase 3: MCP Server (Week 2-3)
- [ ] MCP server setup
- [ ] Natural language query handler
- [ ] Lore surfacing logic
- [ ] Context awareness (current directory)
- [ ] Integration with Claude Desktop

### Phase 4: Smart Features (Week 3-4)
- [ ] Git commit parsing
- [ ] Pattern detection
- [ ] LLM conversation monitoring
- [ ] Auto-capture with confirmation
- [ ] Relationship detection

## Key Implementation Details

### Database Setup

```typescript
// db/schema.sql
const schema = `
  -- Main schema from ARCHITECTURE.md
  CREATE TABLE IF NOT EXISTS realms (...);
  CREATE TABLE IF NOT EXISTS lores (...);
  CREATE TABLE IF NOT EXISTS relations (...);
  CREATE VIRTUAL TABLE IF NOT EXISTS lores_fts (...);
`;

// db/index.ts
import Database from 'better-sqlite3';

export class LoreDB {
  private db: Database.Database;
  
  constructor(dbPath: string = '~/.lorehub/lore.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }
  
  private initialize() {
    this.db.exec(schema);
  }
}
```

### Lore Capture

```typescript
// capture/patterns.ts
export const COMMIT_PATTERNS = [
  /decided to (.+)/i,
  /switched from (.+) to (.+)/i,
  /chose (.+) over (.+)/i,
  /fixed by (.+)/i,
  /workaround:? (.+)/i,
  /gotcha:? (.+)/i,
];

// capture/llm-monitor.ts
export class LLMMonitor {
  detectLoreWorthy(conversation: string): LoreCandidate[] {
    // Smart detection logic
    // Return candidates with confidence scores
  }
}
```

### CLI Commands

```typescript
// cli/commands/add.ts
export async function addLore(content: string, options: AddOptions) {
  const realm = await detectRealm(process.cwd());
  const type = options.type || inferType(content);
  
  const lore = await db.createLore({
    content,
    type,
    realm_id: realm.id,
    source: { type: 'manual', reference: 'cli' }
  });
  
  console.log(`✓ Lore ${lore.id} added`);
}

// cli/commands/search.ts  
export async function search(query: string) {
  const lores = await db.searchLores(query);
  
  // Format output
  lores.forEach(lore => {
    console.log(`[${lore.realm_id}] ${lore.content}`);
    if (lore.why) console.log(`  Why: ${lore.why}`);
  });
}
```

### MCP Interface

```typescript
// mcp/server.ts
export class LoreHubMCP {
  async handleQuery(query: string, context: Context) {
    // Natural language processing
    const intent = parseIntent(query);
    
    switch (intent.type) {
      case 'search':
        return this.searchLores(intent.params);
      case 'relate':
        return this.findRelated(intent.params);
      case 'capture':
        return this.captureLore(intent.params);
    }
  }
  
  async surfaceRelevant(context: Context) {
    // Check current file/project
    // Find relevant lores
    // Return with confidence scores
  }
}
```

### Realm Detection

```typescript
// utils/realm.ts
export async function detectRealm(startPath: string): Promise<Realm> {
  // Walk up to find .git
  const gitRoot = await findGitRoot(startPath);
  
  // Check if monorepo
  const isMonorepo = await checkMonorepoIndicators(gitRoot);
  
  // Detect services if monorepo
  const provinces = isMonorepo ? await detectProvinces(gitRoot) : [];
  
  // Create or update realm
  return db.upsertRealm({
    path: gitRoot,
    name: path.basename(gitRoot),
    is_monorepo: isMonorepo,
    provinces
  });
}
```

## Testing Strategy

### Unit Tests
- Database operations
- Pattern matching
- Realm detection
- Lore inference

### Integration Tests  
- CLI commands
- MCP protocol
- Git integration
- Full workflows

### Manual Testing Checklist
- [ ] Add lores via CLI
- [ ] Search with various queries
- [ ] Test in monorepo
- [ ] Test in regular repo
- [ ] Claude Desktop integration
- [ ] Git commit parsing

## Configuration

```typescript
// ~/.lorehub/config.json
{
  "autoCapture": {
    "enabled": true,
    "requireConfirmation": true,
    "patterns": ["decided", "switched", "chose"]
  },
  "git": {
    "parseCommits": true,
    "ignorePaths": ["node_modules", ".git"]
  },
  "realms": {
    "additionalPaths": ["/special/realm"]
  }
}
```

## Performance Considerations

1. **Indexes**: Create on realm_id, type, status
2. **FTS5**: Use for content and tag searching
3. **Caching**: Cache realm detection results
4. **Batch Operations**: For bulk imports
5. **Connection Pooling**: Single connection, WAL mode

## Security & Privacy

1. **Local Only**: No network calls
2. **Git Safety**: Read-only access
3. **Ignore Patterns**: .lorehubignore file
4. **No Secrets**: Detect and reject

## Deployment

```json
// package.json
{
  "name": "lorehub",
  "bin": {
    "lh": "./dist/cli/index.js",
    "lorehub": "./dist/cli/index.js"
  },
  "mcp": {
    "server": "./dist/mcp/server.js"
  }
}
```

## Error Handling

- Graceful degradation
- Clear error messages
- Fallback to manual entry
- Never lose user data