# LoreHub Implementation Guide

## Quick Start Development Plan

### Phase 1: Foundation (Week 1)
- [ ] Initialize TypeScript project
- [ ] Set up SQLite with better-sqlite3
- [ ] Create database schema and migrations
- [ ] Basic data models (Fact, Project, Relation)
- [ ] Core CRUD operations

### Phase 2: CLI (Week 1-2)
- [ ] CLI structure with commander.js
- [ ] Quick capture: `lh "fact text"`
- [ ] Search: `lh ?query`
- [ ] Project detection (git root)
- [ ] Basic output formatting

### Phase 3: MCP Server (Week 2-3)
- [ ] MCP server setup
- [ ] Natural language query handler
- [ ] Fact surfacing logic
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
  CREATE TABLE IF NOT EXISTS projects (...);
  CREATE TABLE IF NOT EXISTS facts (...);
  CREATE TABLE IF NOT EXISTS relations (...);
  CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts (...);
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

### Fact Capture

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
  detectFactWorthy(conversation: string): FactCandidate[] {
    // Smart detection logic
    // Return candidates with confidence scores
  }
}
```

### CLI Commands

```typescript
// cli/commands/add.ts
export async function addFact(content: string, options: AddOptions) {
  const project = await detectProject(process.cwd());
  const type = options.type || inferType(content);
  
  const fact = await db.createFact({
    content,
    type,
    project_id: project.id,
    source: { type: 'manual', reference: 'cli' }
  });
  
  console.log(`✓ Fact ${fact.id} added`);
}

// cli/commands/search.ts  
export async function search(query: string) {
  const facts = await db.searchFacts(query);
  
  // Format output
  facts.forEach(fact => {
    console.log(`[${fact.project_id}] ${fact.content}`);
    if (fact.why) console.log(`  Why: ${fact.why}`);
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
        return this.searchFacts(intent.params);
      case 'relate':
        return this.findRelated(intent.params);
      case 'capture':
        return this.captureFact(intent.params);
    }
  }
  
  async surfaceRelevant(context: Context) {
    // Check current file/project
    // Find relevant facts
    // Return with confidence scores
  }
}
```

### Project Detection

```typescript
// utils/project.ts
export async function detectProject(startPath: string): Promise<Project> {
  // Walk up to find .git
  const gitRoot = await findGitRoot(startPath);
  
  // Check if monorepo
  const isMonorepo = await checkMonorepoIndicators(gitRoot);
  
  // Detect services if monorepo
  const services = isMonorepo ? await detectServices(gitRoot) : [];
  
  // Create or update project
  return db.upsertProject({
    path: gitRoot,
    name: path.basename(gitRoot),
    is_monorepo: isMonorepo,
    services
  });
}
```

## Testing Strategy

### Unit Tests
- Database operations
- Pattern matching
- Project detection
- Fact inference

### Integration Tests  
- CLI commands
- MCP protocol
- Git integration
- Full workflows

### Manual Testing Checklist
- [ ] Add facts via CLI
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
  "projects": {
    "additionalPaths": ["/special/project"]
  }
}
```

## Performance Considerations

1. **Indexes**: Create on project_id, type, status
2. **FTS5**: Use for content and tag searching
3. **Caching**: Cache project detection results
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