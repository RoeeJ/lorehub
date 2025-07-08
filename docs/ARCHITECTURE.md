# LoreHub Architecture

## Overview

LoreHub is a Model Context Protocol (MCP) server that captures, stores, and surfaces technical decisions, implementation patterns, and project-specific knowledge across multiple codebases. It provides both an MCP interface for LLMs and a CLI for developers.

## Core Principles

1. **Local-first**: Everything works offline, no external dependencies
2. **Zero-config**: Works immediately after install
3. **Append-only**: Facts are immutable, track evolution through relationships
4. **Git-aware**: Understands project boundaries automatically
5. **Service-aware**: Handles monorepos with 70+ microservices

## Tech Stack

- **Language**: TypeScript + Node.js
- **Database**: SQLite with FTS5 (full-text search)
- **MCP Framework**: @modelcontextprotocol/sdk
- **SQLite Driver**: better-sqlite3 (synchronous, faster)
- **CLI Framework**: Commander.js (if needed)

## Architecture Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Claude    │────▶│  MCP Server  │────▶│   SQLite   │
│  (or other) │ RPC │ (TypeScript) │     │    .db     │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                    ┌──────┴───────┐
                    │   Features   │
                    ├──────────────┤
                    │ Git Monitor  │
                    │ Auto-capture │
                    │ Fact Search  │
                    │ Relationships│
                    └──────────────┘

┌─────────────┐     ┌──────────────┐
│ Developer   │────▶│     CLI      │
│  Terminal   │     │   (lh)       │
└─────────────┘     └──────────────┘
```

## Data Model

### Core Entities

```typescript
interface Fact {
  id: string
  project_id: string
  content: string
  why: string  // 1-2 sentence reasoning
  type: 'decision' | 'pattern' | 'gotcha' | 'learning'
  services: string[]  // For monorepo service tagging
  tags: string[]
  confidence: number  // 0-100
  source: {
    type: 'llm-conversation' | 'git-commit' | 'manual' | 'import'
    reference: string  // conversation-id, commit-hash, etc
    context?: string  // file/function being discussed
  }
  status: 'active' | 'superseded' | 'archived'
  supersedes?: string  // Previous fact ID
  superseded_by?: string  // New fact ID
  created_at: Date
  updated_at: Date
}

interface Relation {
  from_fact_id: string
  to_fact_id: string
  type: 'implements' | 'conflicts' | 'related' | 'depends_on' | 'supersedes'
  strength: number  // 0-1 for ranking
  metadata?: Record<string, any>
  created_at: Date
}

interface Project {
  id: string
  name: string
  path: string  // Local filesystem path
  git_remote?: string
  is_monorepo: boolean
  services?: string[]  // Detected service names
  last_seen: Date
  created_at: Date
}
```

### Database Schema

```sql
-- Facts are immutable events
CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  content TEXT NOT NULL,
  why TEXT,
  type TEXT CHECK(type IN ('decision', 'pattern', 'gotcha', 'learning')),
  services TEXT,  -- JSON array
  tags TEXT,      -- JSON array
  confidence INTEGER DEFAULT 80,
  source TEXT NOT NULL,  -- JSON object
  status TEXT DEFAULT 'active',
  supersedes TEXT,
  superseded_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Full-text search index
CREATE VIRTUAL TABLE facts_fts USING fts5(
  content, why, tags, services,
  content=facts
);

-- Bidirectional relationships
CREATE TABLE relations (
  from_fact_id TEXT NOT NULL,
  to_fact_id TEXT NOT NULL,
  type TEXT NOT NULL,
  strength REAL DEFAULT 1.0,
  metadata TEXT,  -- JSON object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (from_fact_id, to_fact_id, type),
  FOREIGN KEY (from_fact_id) REFERENCES facts(id),
  FOREIGN KEY (to_fact_id) REFERENCES facts(id)
);

-- Projects (auto-discovered)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  git_remote TEXT,
  is_monorepo BOOLEAN DEFAULT FALSE,
  services TEXT,  -- JSON array
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_facts_project ON facts(project_id);
CREATE INDEX idx_facts_status ON facts(status);
CREATE INDEX idx_facts_type ON facts(type);
CREATE INDEX idx_relations_from ON relations(from_fact_id);
CREATE INDEX idx_relations_to ON relations(to_fact_id);
```

## Key Features

### 1. Intelligent Fact Capture

**From LLM Conversations**:
- Smart detection of decisions, patterns, gotchas
- Requires confirmation by default (can disable)
- Extracts: fact + reasoning + context
- Example: "Decided to use Redis for session cache" → captures with why

**From Git Commits**:
- Pattern matching: "decided to", "switched from/to", "fixed by"
- Extracts decision + rationale, not commit metadata
- Links to commit hash for reference

**Manual Entry**:
- CLI: `lh "Redis Cluster breaks with Lua scripts"`
- With metadata: `lh @gotcha --tag=redis,scaling "..."`

### 2. Project & Service Detection

**Monorepo Support**:
- Single project with service-level tagging
- Auto-detect from file paths: `/services/auth/main.go` → tag: "auth"
- Cross-service insights: "Show Redis patterns across all services"

**Project Detection**:
- Git root detection (traverse to .git)
- Configurable additional context directories
- Handles nested repos correctly

### 3. Smart Surfacing

**Hybrid Approach**:
- Gentle hints: "📍 Found 3 related facts about auth"
- Expand on request
- Context-aware based on current work

**Relationship Traversal**:
- Follow fact relationships up to 3 hops
- Decay relevance by distance
- Surface conflicts and superseded decisions

### 4. Querying

**MCP Interface** (Natural Language):
```
"What did we decide about caching in the API?"
"Show me all Redis gotchas"
"How do other services handle auth?"
```

**CLI Interface** (Quick Access):
```bash
lh ?redis                    # Quick search
lh ??"auth in api service"   # Natural language
lh list --type=decision      # Structured query
```

## Implementation Phases

### Phase 1: MVP
- Core data model
- Manual fact entry via CLI
- Basic search functionality
- MCP server with simple queries

### Phase 2: Smart Capture
- Git commit parsing
- LLM conversation monitoring
- Auto-capture with confirmation

### Phase 3: Relationships
- Fact linking
- Relationship traversal
- Conflict detection
- Evolution tracking

### Phase 4: Advanced
- Service-aware insights
- Pattern detection
- Bulk import/export
- Visualization

## Future Considerations

### Sync Strategy (v2+)
- Event log in `.lorehub/events/`
- Git-based sync for teams
- Conflict resolution via CRDTs
- Optional cloud sync service

### Performance
- Target: <100ms query response for 100k facts
- FTS5 for full-text search
- Strategic indexes
- Consider materialized views for common queries

### Security
- Local-only by default
- No PII/secrets in storage
- .lorehubignore patterns
- Read-only git access