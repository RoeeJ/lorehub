# LoreHub Design Decisions

This document captures all the key decisions made during the initial design phase.

## Project Scope & Vision

**Decision**: Build as a personal project (Roee) with potential for wider adoption
- Start simple, iterate based on real usage
- Focus on solving real pain points in multi-project development
- Especially valuable for large monorepos (70+ microservices)

## Naming

**Decision**: LoreHub
- **Alternatives considered**: lighthouse, beacon, compass, waypoint, factmap, wisehub
- **Rationale**: Available on npm, memorable, clear purpose
- **CLI alias**: `lh` for quick commands

## Technology Stack

**Decision**: TypeScript + SQLite
- **Language**: TypeScript (MCP ecosystem standard, rapid iteration)
- **Database**: SQLite with FTS5
  - Alternatives: PostgreSQL (requires setup), DuckDB (less mature), Graph DBs (overkill)
  - Rationale: Embedded, zero-config, excellent full-text search
- **Framework**: Official @modelcontextprotocol/sdk
- **SQLite Driver**: better-sqlite3 (synchronous, faster than node-sqlite3)

## Architecture

**Decision**: Local-first with future sync path
- **Storage**: SQLite only for v1
- **Sync**: Defer to v2+ (event log → git sync → cloud)
- **Rationale**: Ship useful tool first, validate core idea before distributed complexity

## Data Model

**Decision**: Rich but distilled facts
- Store: Core fact + why (1-2 sentences) + context + confidence
- **Rationale**: "6 months later, you need the 'why' more than the 'what'"
- Example: 
  ```yaml
  Fact: "Use Redis for session cache"
  Why: "Needed sub-50ms response, in-memory wasn't scaling past 10k"
  Context: "implementing auth in api/auth.ts"
  ```

**Decision**: Immutable facts with relationships
- Facts never change, only superseded
- Track evolution through relationships
- Archive manually or when superseded

## Feature Set

**Decision**: MVP includes intelligent capture + search
- Manual fact entry
- Git commit auto-parsing
- Smart LLM conversation capture
- Basic relationship linking
- Context-aware surfacing

**Decision**: Hybrid auto-capture
- Smart detection with confirmation (default)
- Explicit triggers: "@lorehub: ..." 
- Can disable smart detection

## Project Structure

**Decision**: Single project with service tags
- **Rationale**: Better for monorepos with many services
- Auto-detect services from paths
- Enable cross-service insights
- Example: "Show all Redis decisions across 70 microservices"

**Decision**: Git root detection
- Auto-detect project from .git directory
- Support additional context directories
- Handles nested repositories

## User Interface

**Decision**: Dual interface design
1. **MCP Server**: Natural language queries for LLMs
2. **CLI Tool**: Quick commands for developers

**Decision**: Hybrid surfacing approach
- Gentle hints: "📍 Found 3 related facts"
- Expand on request
- Not intrusive or know-it-all

## CLI Ergonomics

**Decision**: Mixed command style
```bash
# Most common - quick capture
lh "Fact text"
lh @decision "Chose X over Y"

# Search
lh ?redis           # Quick search
lh ??"natural query" # Natural language

# Everything else
lh relate <id1> conflicts <id2>
lh export --format=markdown
```

## Git Integration

**Decision**: Extract decision + rationale from commits
- Pattern detection: "decided to", "switched from/to", "fixed by"
- Store core insight, not commit metadata
- Link to commit hash as source

## Performance Targets

- Query response: <100ms for 100k facts
- Startup time: <500ms
- Memory footprint: <50MB typical usage

## Future Roadmap

1. **v1.0**: Local single-user tool
2. **v2.0**: Export/import capabilities
3. **v3.0**: Git-based team sync
4. **v4.0**: Optional cloud sync service

## Non-Decisions (Deferred)

- Team synchronization strategy
- Conflict resolution approach  
- Cloud service architecture
- Pricing model
- Advanced visualizations