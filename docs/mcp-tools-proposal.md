# MCP Tools Proposal for LoreHub

## Current State
The MCP server currently only exposes read operations:
- `search_facts` - Search facts with wildcards and filters
- `list_facts` - List facts with type/service filters  
- `get_fact` - Get a single fact by ID
- `list_projects` - List all projects

## Proposed Tools to Add

### 1. Fact Management (High Priority)

#### create_fact
```typescript
{
  name: 'create_fact',
  description: 'Create a new fact in a project',
  inputSchema: {
    project_path: string, // Required
    content: string, // Required
    why: string?, // Optional context
    type: FactType, // Required: decision|assumption|constraint|requirement|risk|learning|todo|other
    services: string[]?, // Optional: for monorepos
    tags: string[]?, // Optional
    confidence: number?, // Optional: 0-100, default 80
    source: {
      type: 'user'|'inferred'|'discovered',
      metadata?: any
    }
  }
}
```

#### update_fact
```typescript
{
  name: 'update_fact',
  description: 'Update an existing fact',
  inputSchema: {
    fact_id: string, // Required
    content?: string,
    why?: string,
    type?: FactType,
    services?: string[],
    tags?: string[],
    confidence?: number,
    status?: 'active'|'completed'|'archived'
  }
}
```

#### delete_fact
```typescript
{
  name: 'delete_fact',
  description: 'Permanently delete a fact',
  inputSchema: {
    fact_id: string, // Required
    confirm: boolean // Required: true to confirm deletion
  }
}
```

#### archive_fact
```typescript
{
  name: 'archive_fact',
  description: 'Archive a fact (soft delete)',
  inputSchema: {
    fact_id: string // Required
  }
}
```

#### restore_fact
```typescript
{
  name: 'restore_fact',
  description: 'Restore an archived fact',
  inputSchema: {
    fact_id: string // Required
  }
}
```

### 2. Relation Management (Medium Priority)

#### create_relation
```typescript
{
  name: 'create_relation',
  description: 'Create a relationship between two facts',
  inputSchema: {
    from_fact_id: string, // Required
    to_fact_id: string, // Required
    type: string, // Required: e.g., "depends-on", "contradicts", "implements", "relates-to"
    strength?: number, // Optional: 0.0-1.0, default 1.0
    metadata?: object // Optional: additional context
  }
}
```

#### delete_relation
```typescript
{
  name: 'delete_relation',
  description: 'Delete a relationship between facts',
  inputSchema: {
    from_fact_id: string, // Required
    to_fact_id: string, // Required
    type: string // Required
  }
}
```

#### list_relations
```typescript
{
  name: 'list_relations',
  description: 'List all relationships for a fact',
  inputSchema: {
    fact_id: string, // Required
    direction?: 'from'|'to'|'both' // Optional: default 'both'
  }
}
```

### 3. Analytics & Insights (Medium Priority)

#### get_project_stats
```typescript
{
  name: 'get_project_stats',
  description: 'Get statistics about a project',
  inputSchema: {
    project_path: string // Required
  },
  returns: {
    total_facts: number,
    facts_by_type: Record<FactType, number>,
    facts_by_status: Record<FactStatus, number>,
    facts_by_service: Record<string, number>,
    recent_facts: Fact[], // Last 5
    high_confidence_facts: number, // confidence >= 90
    low_confidence_facts: number, // confidence < 50
    fact_growth: { // Facts created per week for last 4 weeks
      week1: number,
      week2: number,
      week3: number,
      week4: number
    }
  }
}
```

### 4. Bulk Operations (Low Priority)

#### bulk_create_facts
```typescript
{
  name: 'bulk_create_facts',
  description: 'Create multiple facts at once',
  inputSchema: {
    project_path: string, // Required
    facts: Array<{
      content: string,
      type: FactType,
      // ... other fact properties
    }> // Required
  }
}
```

#### search_by_tags
```typescript
{
  name: 'search_by_tags',
  description: 'Search facts by tags',
  inputSchema: {
    tags: string[], // Required: facts must have ALL these tags
    project_path?: string, // Optional: limit to project
    match_mode?: 'all'|'any' // Optional: default 'all'
  }
}
```

### 5. Import/Export (Low Priority)

#### export_project
```typescript
{
  name: 'export_project',
  description: 'Export all data for a project',
  inputSchema: {
    project_path: string, // Required
    include_relations?: boolean // Optional: default true
  },
  returns: {
    project: Project,
    facts: Fact[],
    relations?: Relation[]
  }
}
```

## Implementation Plan

### Phase 1: Core Fact Management
1. Add create_fact tool
2. Add update_fact tool  
3. Add delete_fact and archive_fact tools
4. Add restore_fact tool

### Phase 2: Relations & Analytics
1. Add create_relation tool
2. Add delete_relation tool
3. Add list_relations tool
4. Add get_project_stats tool

### Phase 3: Advanced Features
1. Add bulk_create_facts tool
2. Add search_by_tags tool
3. Add export_project tool

## Use Cases

### AI Assistants
- **Create facts during code analysis**: "I found that this service depends on Redis for caching"
- **Update facts when things change**: "The API rate limit has been increased to 1000 req/min"
- **Archive completed TODOs**: "This TODO has been implemented"
- **Create relations**: "This decision contradicts the previous architecture choice"

### Development Workflows
- **Track decisions**: Create decision facts with high confidence
- **Document assumptions**: Create assumption facts that need validation
- **Manage technical debt**: Create TODO facts and update their status
- **Knowledge synthesis**: Create relations between related facts

### Team Collaboration
- **Export project knowledge**: Share project understanding with new team members
- **Bulk import facts**: Migrate from other documentation systems
- **Search by tags**: Find all security-related facts or performance constraints

## Security Considerations

1. **Project Path Validation**: Ensure project_path exists before creating facts
2. **ID Validation**: Verify fact_id exists before update/delete operations
3. **Confirmation for Destructive Operations**: Require explicit confirmation for delete_fact
4. **Rate Limiting**: Consider adding rate limits for bulk operations
5. **Audit Trail**: Log all write operations for accountability

## Error Handling

All write operations should return clear error messages:
- "Project not found at path: X"
- "Fact not found with ID: Y"
- "Cannot create relation: facts must be in same project"
- "Invalid fact type: must be one of [...]"