# Implementation Gaps

This document tracks gaps between the README/documentation and the actual implementation as of v0.2.1.

## 1. CLI Features

### 1.1 Inline Add Command
**Status**: ✅ Fixed  
**Issue**: ✅ FIXED in v0.2.1 - `lh add "lore content"` now works correctly  
**Expected**: Should add lore directly without interactive UI  
**Priority**: High - This is a basic usability feature

### 1.2 Add Command UI Consistency
**Status**: 🟡 Partially Implemented  
**Issue**: AddLore component doesn't use AlternativeScreenView  
**Impact**: Visual inconsistency between add and list/search views  
**Priority**: Medium - Affects user experience

## 2. Documentation Gaps

### 2.1 MCP Tools Documentation
**Status**: 🔴 Severely Outdated  
**Current README**: Lists only 4 tools  
**Actual Implementation**: 14 tools available  

Missing from documentation:
- `create_lore` - Create new lores via MCP
- `update_lore` - Update existing lores
- `delete_lore` - Hard delete lores
- `archive_lore` - Soft delete/archive lores
- `restore_lore` - Restore archived lores
- `create_relation` - Create lore relationships
- `delete_relation` - Remove lore relationships
- `list_relations` - List relationships for a lore
- `get_realm_stats` - Get realm statistics
- `semantic_search_lores` - Search using embeddings
- `find_similar_lores` - Find similar lores to a given lore

**Priority**: High - MCP users don't know these features exist

### 2.2 New Features Not Documented
**Status**: ✅ Updated in v0.2.1  

Now documented features (v0.2.1):
- Similar lores navigation (`s` key in list view)
- Similar lores count display (e.g., "10≈")
- Navigation history (`b` to go back)
- Alternative screen mode
- Dynamic terminal dimensions
- Fixed-width formatting
- `migrate-embeddings` command
- `--semantic` flag for semantic search
- `similar` command

**Priority**: High - Users missing out on major features

## 3. Unimplemented Features

### 3.1 Git Integration
**Status**: 🔴 Not Implemented  
**README Claims**: "Automatically captures wisdom from git commits"  
**Reality**: No git integration exists  
**Priority**: Medium - Nice to have but not critical

### 3.2 Configuration File Support
**Status**: 🔴 Not Implemented  
**README Shows**: JSON configuration example  
**Reality**: No config file support  
**Components**:
- autoCapture settings
- git commit parsing patterns
- requireConfirmation option

**Priority**: Low - System works without it

### 3.3 Cross-Service Insights
**Status**: 🟡 Ambiguous  
**README Claims**: "Cross-service insights"  
**Reality**: Just search functionality, no dedicated insights feature  
**Priority**: Low - May just need documentation clarification

## 4. Project Status Inaccuracies

### 4.1 Lore Relationships
**Status**: ✅ Implemented and documented  
**Tools Available**:
- create_relation
- delete_relation  
- list_relations

**Action**: ✅ Updated in v0.2.1

### 4.2 Time-based Queries
**Status**: 🟡 Partially Implemented  
**Available**: Lores have timestamps, can sort by date  
**Missing**: No specific time-based query syntax  
**Priority**: Low

## 5. Code Quality Issues

### 5.1 Error Handling in Tests
**Status**: 🟡 Minor Issue  
**Problem**: Embedding generation errors in tests due to closed DB  
**Impact**: Noisy test output  
**Priority**: Low - Tests still pass

### 5.2 TypeScript Strict Mode
**Status**: 🟡 Could be improved  
**Issue**: Some any types, optional chaining could be stricter  
**Priority**: Low

## 6. Missing Commands

### 6.1 Bulk Operations
**Status**: 🔴 Not Implemented  
**Useful Commands**:
- `lh delete --all --type=quest` - Bulk delete by criteria
- `lh archive --older-than=30d` - Archive old lores
- `lh sigil add <sigil> --lores=<ids>` - Bulk sigilizing

**Priority**: Low - Nice to have

### 6.2 Statistics Command
**Status**: 🟡 Partially Implemented  
**Available**: Via MCP tool `get_realm_stats`  
**Missing**: CLI command `lh stats`  
**Priority**: Low

## 7. UI/UX Improvements Needed

### 7.1 Loading States
**Status**: 🟡 Inconsistent  
**Issue**: Similar lores count loading has no visual indicator  
**Priority**: Medium

### 7.2 Empty States
**Status**: ✅ Implemented  
**Note**: Good empty state messages exist

### 7.3 Help Documentation
**Status**: ✅ Expanded in v0.2.1  
**Issue**: ✅ Fixed - Help now shows all shortcuts and commands  
**Priority**: Low

## 8. Ideas from Competitive Analysis

### 8.1 Hybrid Search Scoring
**Status**: ✅ Implemented in v0.2.1  
**Current**: Separate keyword and semantic search  
**Improvement**: Combine scores for better results  
```typescript
// Weighted scoring approach
const hybridScore = 0.3 * keywordScore + 0.7 * semanticScore;
```
**Benefits**: More accurate results by leveraging both approaches  
**Priority**: Medium - Would improve search quality

### 8.2 Vector Storage Abstraction Layer
**Status**: 🔴 Not Implemented  
**Current**: Tightly coupled to sqlite-vec  
**Improvement**: Abstract interface for vector storage  
```typescript
interface VectorStorage {
  store(id: string, vector: number[]): Promise<void>;
  search(vector: number[], limit: number): Promise<SearchResult[]>;
}

class SqliteVecStorage implements VectorStorage { }
class QdrantStorage implements VectorStorage { }
```
**Benefits**: Future flexibility, easier testing  
**Priority**: Low - Current solution works well

### 8.3 Task-Memory Linking
**Status**: 🔴 Not Implemented  
**Concept**: Connect lores to specific tasks/goals  
**Implementation Ideas**:
- Add `taskId` field to lores
- Create task management commands
- Link lores to active tasks
- Filter lores by task context
**Benefits**: Better context for why lores were created  
**Priority**: Medium - Adds valuable context

### 8.4 Memory Categories
**Status**: 🟡 Partial (via types)  
**Current**: Single "lore" concept with types (decree, lesson, quest, etc.)  
**Enhancement**: Separate categories for different knowledge types  
```typescript
type KnowledgeCategory = 'lore' | 'memory' | 'task' | 'insight' | 'pattern';
```
**Benefits**: Richer semantic organization  
**Priority**: Low - Current types may be sufficient

### 8.5 Real-time Index Updates
**Status**: 🟡 Batch updates only  
**Current**: `migrate-embeddings` command for batch processing  
**Improvement**: Generate embeddings on lore creation  
**Note**: Already attempted but needs error handling improvement  
**Priority**: Medium - Better user experience

### 8.6 Combined Search Interface
**Status**: ✅ Implemented in v0.2.1  
**Current**: Separate flags for semantic (`--semantic`) vs keyword search  
**Improvement**: Single search that automatically uses both  
```bash
lh search "database decrees" --hybrid
```
**Benefits**: Users don't need to choose search type  
**Priority**: High - Major UX improvement

## Action Plan (Updated for v0.2.2)

### High Priority (v0.2.1) ✅ COMPLETED
1. ✅ Fix inline add command
2. ✅ Update README with all MCP tools
3. ✅ Document new v0.2.0 features
4. ✅ Add AlternativeScreenView to AddLore
5. ✅ Implement hybrid search (`--hybrid` flag)

### High Priority (v0.2.2)
1. Add visual loading indicators
2. Implement git integration (basic)
3. Add `lh stats` command
4. Hybrid search scoring algorithm
5. Task-memory linking system
6. Fix real-time embedding generation

### Medium Priority (v0.3.0)
1. Configuration file support
2. Bulk operations
3. Enhanced time-based queries
4. Clarify "insights" vs search
5. Vector storage abstraction layer
6. Extended knowledge categories

## Notes

- Some "missing" features may be intentionally simplified (e.g., insights = search)
- Git integration is marked as a major feature but may not be needed by all users
- The MCP implementation is actually more complete than the CLI in some ways