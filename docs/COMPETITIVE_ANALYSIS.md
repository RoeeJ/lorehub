# Competitive Analysis: LoreHub vs Competitor

## Embeddings & Semantic Search Comparison

### Their Implementation
- **Model**: `all-MiniLM-L6-v2` via `@xenova/transformers`
- **Storage**: Local JSON files (`vectors/memory-index.json`, `vectors/task-index.json`)
- **Strategy**: Hybrid search (keywords + semantic)
- **Scale**: In-memory for thousands of items

### LoreHub Implementation
- **Model**: Same `all-MiniLM-L6-v2` via `@xenova/transformers`
- **Storage**: SQLite with `sqlite-vec` extension
- **Strategy**: Both traditional and semantic search
- **Scale**: Optimized for larger datasets with SQL indexing

## Key Differences

### 1. Storage Architecture

**Their Approach**:
```javascript
// JSON files for vector storage
vectors/memory-index.json
vectors/task-index.json
```

**LoreHub Approach**:
```sql
-- Native SQL with vector extension
CREATE VIRTUAL TABLE lores_vec USING vec0(
  lore_id TEXT PRIMARY KEY,
  embedding FLOAT[384]
)
```

### 2. Scalability

| Aspect | Competitor | LoreHub |
|--------|-----------|---------|
| Max Items | ~10K (in-memory) | 100K+ (indexed) |
| Query Speed | O(n) full scan | O(log n) indexed |
| Memory Usage | Loads all vectors | Loads on demand |
| Persistence | JSON files | Database with ACID |

### 3. Search Capabilities

**Competitor**:
- Hybrid search (keywords + semantic)
- Top-K results only
- Project filtering

**LoreHub**:
- Multiple search modes:
  - Traditional SQL wildcards
  - Semantic search (`--semantic`)
  - Similar lores navigation
- Advanced filtering:
  - By type, province, realm
  - By confidence score
  - By date ranges
- Relationship traversal

### 4. Integration Approach

**Competitor**:
- TaskMemoryLinker for connecting tasks to memories
- In-process only

**LoreHub**:
- MCP server for LLM integration
- CLI for human interaction
- Can work across processes

## Advantages We Have

### 1. **Better Scalability**
```sql
-- LoreHub uses proper database indexing
CREATE INDEX idx_lores_vec_embedding ON lores_vec(embedding);
-- Can handle 100K+ lores efficiently
```

### 2. **Richer Data Model**
```typescript
// LoreHub tracks more context
interface Lore {
  content: string
  why?: string  // Reasoning
  confidence: number
  provinces: string[]  // Monorepo support
  source: Source  // Provenance
  // ... relationships, etc
}
```

### 3. **Production Features**
- ACID transactions
- Backup/restore with export/import
- Soft delete (archiving)
- Migration support
- Relationship tracking

### 4. **Better UX**
- Alternative screen mode
- Dynamic terminal sizing
- Similar lores navigation with history
- Fixed-width formatting

## Advantages They Have

### 1. **Simpler Setup**
- No SQLite dependency
- Pure JavaScript/JSON

### 2. **Task Integration**
- TaskMemoryLinker concept
- Direct task-to-memory connections

### 3. **Lighter Weight**
- No database process
- Smaller install size

## What We Could Learn

### 1. **Hybrid Search Scoring**
Their weighted scoring approach:
```javascript
// Combine keyword + semantic scores
const combinedScore = 0.3 * keywordScore + 0.7 * semanticScore
```

We could add this to our semantic search.

### 2. **Abstraction Layer**
```javascript
class VectorStorage {
  // Abstract interface
}
class QdrantVectorStorage extends VectorStorage {
  // Easy to swap backends
}
```

We're tied to sqlite-vec, could add abstraction.

### 3. **Memory Categories**
They seem to have "memory" and "task" as separate concepts. We could add:
- Fact categories beyond our types
- Task-specific lores
- Memory lifecycle management

## Our Unique Strengths

### 1. **Monorepo Support**
- Province-level tracking
- Cross-province insights
- 70+ provinces tested

### 2. **MCP Integration**
- 14 MCP tools
- Full CRUD via LLM
- Relationship management

### 3. **Professional CLI**
- Ink-based UI
- Keyboard shortcuts
- Export formats (JSON/Markdown)

### 4. **Lore Relationships**
- supersedes, contradicts, supports
- Relationship strength
- Traversal capabilities

## Migration Path for Their Users

If someone wanted to migrate from their system to LoreHub:

```bash
# 1. Export their data (they'd need to implement)
node export-memories.js > memories.json

# 2. Transform to our format
node transform-to-lorehub.js memories.json > lores.json

# 3. Import to LoreHub
lh import lores.json

# 4. Generate embeddings
lh migrate-embeddings
```

## Conclusion

While they have a simpler, lighter-weight approach that's great for small projects, LoreHub is designed for:
- Production use at scale
- Complex codebases (monorepos)
- Long-term knowledge retention
- Team collaboration via MCP

Their focus seems to be on task management with memory, while ours is on organizational knowledge management.