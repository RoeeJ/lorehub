# LoreHub Development - Current State

## Session Date: 2025-01-08

## Completed Tasks

### 1. Project Planning & Architecture ✅
- Decided on name: **LoreHub** (CLI alias: `lh`)
- Tech stack: TypeScript + SQLite + better-sqlite3 + MCP SDK + Zod
- Architecture: Local-first, event-sourced lores
- Created comprehensive documentation:
  - `docs/ARCHITECTURE.md` - Technical architecture
  - `docs/DECISIONS.md` - Design decisions
  - `docs/IMPLEMENTATION.md` - Development guide
  - `README.md` - User documentation

### 2. Project Setup ✅
- Fixed directory issue (moved from ~/Developer/Projects to ~/Developer/lorehub)
- Initialized npm project with proper package.json
- Installed dependencies:
  - Production: better-sqlite3, @modelcontextprotocol/sdk, zod, commander, ink, react
  - Dev: TypeScript, Vitest, ESLint, types
- Created strict TypeScript configuration (tsconfig.json)
- Set up Vitest for TDD with coverage and benchmarking

### 3. TDD Implementation ✅

#### Core Types ✅
- Created first test file: `src/core/types.test.ts`
- Implemented `src/core/types.ts` with Zod schemas
- Completed RED-GREEN-REFACTOR cycle:
  - LoreSchema, RelationSchema, RealmSchema
  - Type guards (isLore, isRelation, isRealm)
  - Utility types (CreateLoreInput, UpdateLoreInput, etc.)
  - Performance-focused validation helpers
- All 15 tests passing

#### Database Layer ✅
- Created comprehensive test suite: `src/db/database.test.ts`
- Implemented `src/db/database.ts` with better-sqlite3
- Features implemented:
  - SQLite connection with WAL mode for performance
  - Complete CRUD operations for Realms, Lores, Relations
  - Transaction support with rollback
  - Performance indexes on key columns
  - Bulk insert optimization
  - Search functionality with wildcard support (* and ?)
- All 21 database tests passing

#### CLI Implementation ✅
- Implemented with Commander.js for argument parsing
- Ink for beautiful TUI components
- Features completed:
  - `lh add` - Add lores to current realm (inline or interactive mode with Ink UI)
  - `lh realm` - Show realm information and stats
  - `lh search` - Search lores across ALL realms with wildcard support
  - `lh list` - List lores from ALL realms with interactive selection
- Global knowledge hub approach:
  - Lores always added to current realm
  - Search/list show lores from ALL realms by default
  - Current realm lores marked with ⭐
  - Use `--current` flag to limit to current realm only
  - Use `-r <path>` to filter by specific realm
- Smart realm detection from package.json/git
- Non-TTY support for CI/CD environments
- Database stored in ~/.lorehub/lorehub.db
- Fixed all interactive UI issues:
  - Tab/Shift-Tab navigation working
  - Enter to submit forms
  - Auto-update of list view selection
  - No more header duplication

#### MCP Server Implementation ✅
- Created MCP server for AI assistant integration
- Implemented lore querying tools:
  - `search_lores`: Search across ALL realms by default (with wildcards and filters)
  - `list_lores`: List from ALL realms by default (with type/province filters)
  - `get_lore`: Get specific lore by ID
  - `list_realms`: List all realms
- Global knowledge hub in MCP:
  - Tools search/list across all realms by default
  - Optional `realm_path` parameter to limit to specific realm
  - Response includes realm information for each lore
- Full test coverage for MCP server (15 tests passing)
- Proper error handling and validation
- Package.json MCP configuration added
- Entry point at `dist/mcp/index.js` (executable)

## Current Working Directory
`/Users/roeej/Developer/Projects/lorehub`

## Directory Structure
```
lorehub/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CURRENT_STATE.md (this file)
│   ├── DECISIONS.md
│   └── IMPLEMENTATION.md
├── src/
│   ├── core/
│   │   ├── types.ts ✅
│   │   └── types.test.ts ✅
│   ├── db/
│   │   ├── database.ts ✅
│   │   └── database.test.ts ✅
│   ├── cli/
│   │   ├── cli.ts ✅
│   │   ├── cli.test.ts ✅
│   │   ├── commands/
│   │   │   ├── add.tsx ✅
│   │   │   ├── list.tsx ✅
│   │   │   ├── realm.tsx ✅
│   │   │   ├── browse.tsx ✅
│   │   │   ├── export.tsx ✅
│   │   │   └── import.tsx ✅
│   │   ├── components/
│   │   │   ├── AddLore.tsx ✅
│   │   │   ├── AddLore.test.tsx ✅
│   │   │   ├── LoresView.tsx ✅
│   │   │   ├── SimilarLoresView.tsx ✅
│   │   │   ├── Help.tsx ✅
│   │   │   ├── ErrorMessage.tsx ✅
│   │   │   └── Progress.tsx ✅
│   │   └── utils/
│   │       ├── db-config.ts ✅
│   │       └── realm.ts ✅ (renamed from project.ts)
│   ├── mcp/
│   │   ├── server.ts ✅
│   │   ├── server.test.ts ✅
│   │   └── index.ts ✅
│   └── index.ts ✅
├── tests/
├── bench/
├── dist/ (built files)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## All Tests Passing
- Core types: 14 tests ✅
- Database: 21 tests ✅
- CLI: 8 tests (1 skipped) ✅
- CLI Components: 9 tests (3 skipped) ✅
- MCP Server: 15 tests ✅
- **Total: 67 tests passing, 4 skipped**

## Recent Updates (2025-01-09)
- Fixed test failures by properly mocking Ink components
- Created comprehensive MCP Usage Guide (docs/MCP_USAGE.md)
- Updated README to reference MCP documentation
- All tests passing, project builds successfully
- Implemented grid-based UI layout with fixed heights (20 lines)
- Added vim-style search functionality (/) to list and search views
- Redesigned AddLore screen with two-column layout and preview
- Added keyboard shortcuts help component (? key)
- Created centralized error handling with user-friendly messages
- Added progress indicators for long operations
- Implemented export/import functionality (JSON and Markdown formats)

## Next Steps (TODO)

1. **Polish Phase**: ✅ COMPLETE
   - ✅ Improve UI components styling (grid-based layout)
   - ✅ Add more keyboard shortcuts (/, ?, Ctrl+S)
   - ✅ Better error messages (ErrorMessage component)
   - ✅ Progress indicators for long operations

2. **Additional Features**:
   - ✅ Export/import functionality (JSON and Markdown)
   - Lore relationships visualization
   - Time-based queries
   - Lore history/versions

3. **AI Integration**:
   - Document MCP usage for Claude/Cursor
   - Create example prompts
   - Build lore suggestion system

4. **Publishing**:
   - Add npm scripts for installation
   - Create installation guide
   - Set up GitHub Actions for CI/CD
   - Publish to npm registry

## Key Decisions Made

1. **TypeScript Strict Mode**: Using maximum strictness for type safety
2. **TDD Approach**: Red-Green-Refactor cycle (66 tests passing!)
3. **Performance Focus**: 
   - better-sqlite3 for synchronous operations
   - Vitest with thread pool for tests
   - Benchmarking setup ready
4. **Type Safety**: Using Zod for runtime validation
5. **UI Framework**: Ink (React for CLI) for interactive components
6. **MCP Integration**: Full Model Context Protocol support

## Development Guidelines Established

1. Everything must be type-safe
2. TDD (Red-Green-Refactor) approach
3. Performance is critical - benchmark everything
4. ESM modules (type: "module" in package.json)
5. Interactive UI with Ink for better UX

## Commands to Resume

```bash
cd ~/Developer/Projects/lorehub

# Run all tests
npm test

# Watch mode for TDD
npm run test:watch

# Type checking
npm run typecheck

# Build
npm run build

# Test CLI locally
npm link
lh add
lh browse
lh realm

# Test MCP server
./dist/mcp/index.js
```

## Current Task
v0.2.1 Released! Complete terminology pivot to fantasy theme with all legacy code removed. Full CLI and MCP support with new lore/realm/province terminology.

## Major Terminology Pivot (2025-01-09) ✅ COMPLETED

### Overview
Pivoting from "facts" to "lores" to better align with the LoreHub brand and create a more cohesive, thematic experience while maintaining professionalism.

### Terminology Changes

#### Core Entities
- **Fact/Facts** → **Lore/Lores** (countable pieces of wisdom)
- **Project** → **Realm** (each codebase is its own realm)
- **Todo** → **Quest** (knowledge to be gained)

#### Lore Types
- **Decision** → **Decree** (architectural choices made)
- **Learning** → **Lesson** (wisdom gained from experience)
- **Assumption** → Assumption (kept as is)
- **Constraint** → Constraint (kept as is)
- **Requirement** → Requirement (kept as is)
- **Risk** → Risk (kept as is)

#### What Stays the Same
- All CLI commands (add, search, list, etc.) - for familiarity
- Confidence levels
- Sigils (tags) and provinces terminology
- Database field structure (just renamed tables)

### Implementation Status ✅ COMPLETED

1. **Database Migration** ✅
   - Created migration to rename `facts` table to `lores`
   - Updated all indexes and constraints
   - Preserved existing data
   - Migration completed successfully

2. **Code Updates** ✅
   - Types: `Fact` → `Lore`, `FactType` → `LoreType` ✅
   - Interfaces: `CreateFactInput` → `CreateLoreInput` ✅
   - Functions: `createFact()` → `createLore()`, etc. ✅
   - Variables: `factId` → `loreId`, `factCount` → `loreCount` ✅
   - Database queries and references ✅
   - All legacy code removed in v0.2.1

3. **UI/Display Text Updates** ✅
   - "Add New Fact" → "Add New Lore" ✅
   - "Similar facts (10≈)" → "Similar lores (10≈)" ✅
   - "✓ Fact created successfully" → "✓ Lore created successfully" ✅
   - "Found 25 facts" → "Found 25 lores" ✅
   - "Project: lorehub" → "Realm: lorehub" ✅

4. **MCP Tools Renaming** ✅
   - `create_fact` → `create_lore` ✅
   - `search_facts` → `search_lores` ✅
   - `list_facts` → `list_lores` ✅
   - Updated all tool descriptions ✅

5. **Documentation Updates** ✅
   - README.md ✅
   - All guides and examples ✅
   - Code comments ✅
   - Test descriptions ✅

### Rationale
- "Lore" better captures accumulated wisdom and team knowledge
- Creates stronger brand identity with LoreHub
- More evocative than clinical "facts"
- Maintains professionalism while adding character

### Migration Completed ✅
Successfully executed database migration that:
1. Creates new tables (realms, lores, lore_relations) with updated terminology
2. Copies all data from old tables with type conversions (decision→decree, learning→lesson, todo→quest)
3. Creates compatibility views so the application continues working during the transition
4. Preserves vector embeddings if they exist
5. Can be rolled back if needed

Migration files created:
- `/drizzle/0002_lore_terminology_migration.sql` - Main migration
- `/drizzle/0002_lore_terminology_migration_rollback.sql` - Rollback script
- `/scripts/migrate-to-lore-terminology.js` - Executable migration runner

Run with: `node scripts/migrate-to-lore-terminology.js`
Rollback with: `node scripts/migrate-to-lore-terminology.js --rollback`