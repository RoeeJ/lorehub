import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { Database } from '../db/database.js';
import { getDbPath } from '../cli/utils/db-config.js';
import type { Fact, FactType, RelationType } from '../core/types.js';

// Tool schemas
const SearchFactsSchema = z.object({
  query: z.string().describe('Search query (supports wildcards * and ?)'),
  project_path: z.string().optional().describe('Project path to search in (searches all projects if not specified)'),
  type: z.enum(['decision', 'assumption', 'constraint', 'requirement', 'risk', 'learning', 'todo', 'other']).optional(),
  service: z.string().optional().describe('Filter by service (for monorepos)'),
  limit: z.number().optional().default(50).describe('Maximum number of results'),
});

const ListFactsSchema = z.object({
  project_path: z.string().optional().describe('Project path to list facts from (lists from all projects if not specified)'),
  type: z.enum(['decision', 'assumption', 'constraint', 'requirement', 'risk', 'learning', 'todo', 'other']).optional(),
  service: z.string().optional().describe('Filter by service (for monorepos)'),
  limit: z.number().optional().default(20).describe('Maximum number of results'),
});

const GetFactSchema = z.object({
  fact_id: z.string().describe('The ID of the fact to retrieve'),
});

const ListProjectsSchema = z.object({});

const CreateFactSchema = z.object({
  project_path: z.string().describe('Project path where the fact should be created'),
  content: z.string().describe('The main content of the fact'),
  why: z.string().optional().describe('Additional context or reasoning for this fact'),
  type: z.enum(['decision', 'assumption', 'constraint', 'requirement', 'risk', 'learning', 'todo', 'other']).describe('The type of fact'),
  services: z.array(z.string()).optional().describe('Services this fact applies to (for monorepos)'),
  tags: z.array(z.string()).optional().describe('Tags for categorizing the fact'),
  confidence: z.number().min(0).max(100).optional().default(80).describe('Confidence level (0-100)'),
  source: z.object({
    type: z.enum(['manual', 'inferred', 'imported']).default('manual'),
    reference: z.string().default('mcp'),
    context: z.string().optional(),
  }).optional().default({ type: 'manual', reference: 'mcp' }),
});

const UpdateFactSchema = z.object({
  fact_id: z.string().describe('The ID of the fact to update'),
  content: z.string().optional().describe('Updated content of the fact'),
  why: z.string().optional().describe('Updated context or reasoning'),
  type: z.enum(['decision', 'assumption', 'constraint', 'requirement', 'risk', 'learning', 'todo', 'other']).optional(),
  services: z.array(z.string()).optional().describe('Updated services list'),
  tags: z.array(z.string()).optional().describe('Updated tags list'),
  confidence: z.number().min(0).max(100).optional().describe('Updated confidence level'),
  status: z.enum(['active', 'completed', 'archived']).optional().describe('Updated status'),
  source: z.object({
    type: z.enum(['manual', 'inferred', 'imported']),
    reference: z.string(),
    context: z.string().optional(),
  }).optional(),
});

const DeleteFactSchema = z.object({
  fact_id: z.string().describe('The ID of the fact to delete'),
  confirm: z.boolean().describe('Must be true to confirm deletion'),
});

const ArchiveFactSchema = z.object({
  fact_id: z.string().describe('The ID of the fact to archive'),
});

const RestoreFactSchema = z.object({
  fact_id: z.string().describe('The ID of the fact to restore'),
});

const CreateRelationSchema = z.object({
  from_fact_id: z.string().describe('The ID of the source fact'),
  to_fact_id: z.string().describe('The ID of the target fact'),
  type: z.enum(['supersedes', 'contradicts', 'supports', 'depends_on', 'relates_to']).describe('The type of relationship'),
  strength: z.number().min(0).max(1).optional().default(1.0).describe('Strength of the relationship (0.0-1.0)'),
  metadata: z.record(z.unknown()).optional().describe('Additional metadata for the relationship'),
});

const DeleteRelationSchema = z.object({
  from_fact_id: z.string().describe('The ID of the source fact'),
  to_fact_id: z.string().describe('The ID of the target fact'),
  type: z.enum(['supersedes', 'contradicts', 'supports', 'depends_on', 'relates_to']).describe('The type of relationship to delete'),
});

const ListRelationsSchema = z.object({
  fact_id: z.string().describe('The ID of the fact to list relationships for'),
  direction: z.enum(['from', 'to', 'both']).optional().default('both').describe('Direction of relationships to list'),
});

const GetProjectStatsSchema = z.object({
  project_path: z.string().describe('The project path to get statistics for'),
});

const SemanticSearchFactsSchema = z.object({
  query: z.string().describe('Natural language query to find semantically similar facts'),
  project_path: z.string().optional().describe('Project path to search in (searches all projects if not specified)'),
  threshold: z.number().min(0).max(1).optional().default(0.7).describe('Similarity threshold (0-1, higher is more similar)'),
  limit: z.number().optional().default(20).describe('Maximum number of results'),
});

const FindSimilarFactsSchema = z.object({
  fact_id: z.string().describe('The ID of the fact to find similar facts for'),
  limit: z.number().optional().default(10).describe('Maximum number of similar facts to return'),
  threshold: z.number().min(0).max(1).optional().default(0.5).describe('Similarity threshold (0-1)'),
});

export class LoreHubServer {
  private server: Server;
  private db: Database;

  constructor(dbPathOrInstance?: string | Database) {
    this.server = new Server(
      {
        name: 'lorehub',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    if (typeof dbPathOrInstance === 'object' && dbPathOrInstance !== null) {
      // Assume it's a Database instance or mock
      this.db = dbPathOrInstance as Database;
    } else {
      this.db = new Database(dbPathOrInstance || getDbPath());
    }
    this.setupHandlers();
  }

  private setupHandlers() {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_facts',
            description: 'Search facts across all projects with optional filters',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query (supports wildcards * and ?)' },
                project_path: { type: 'string', description: 'Project path to search in (searches all projects if not specified)' },
                type: { 
                  type: 'string', 
                  enum: ['decision', 'assumption', 'constraint', 'requirement', 'risk', 'learning', 'todo', 'other'],
                  description: 'Filter by fact type' 
                },
                service: { type: 'string', description: 'Filter by service (for monorepos)' },
                limit: { type: 'number', description: 'Maximum number of results', default: 50 },
              },
              required: ['query'],
            },
          },
          {
            name: 'list_facts',
            description: 'List facts from all projects with optional filters',
            inputSchema: {
              type: 'object',
              properties: {
                project_path: { type: 'string', description: 'Project path to list facts from (lists from all projects if not specified)' },
                type: { 
                  type: 'string', 
                  enum: ['decision', 'assumption', 'constraint', 'requirement', 'risk', 'learning', 'todo', 'other'],
                  description: 'Filter by fact type' 
                },
                service: { type: 'string', description: 'Filter by service (for monorepos)' },
                limit: { type: 'number', description: 'Maximum number of results', default: 20 },
              },
              required: [],
            },
          },
          {
            name: 'get_fact',
            description: 'Get a specific fact by ID',
            inputSchema: {
              type: 'object',
              properties: {
                fact_id: { type: 'string', description: 'The ID of the fact to retrieve' },
              },
              required: ['fact_id'],
            },
          },
          {
            name: 'list_projects',
            description: 'List all projects in the LoreHub database',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'create_fact',
            description: 'Create a new fact in a project',
            inputSchema: {
              type: 'object',
              properties: {
                project_path: { type: 'string', description: 'Project path where the fact should be created' },
                content: { type: 'string', description: 'The main content of the fact' },
                why: { type: 'string', description: 'Additional context or reasoning for this fact' },
                type: { 
                  type: 'string', 
                  enum: ['decision', 'assumption', 'constraint', 'requirement', 'risk', 'learning', 'todo', 'other'],
                  description: 'The type of fact' 
                },
                services: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Services this fact applies to (for monorepos)' 
                },
                tags: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Tags for categorizing the fact' 
                },
                confidence: { 
                  type: 'number', 
                  minimum: 0, 
                  maximum: 100,
                  description: 'Confidence level (0-100)', 
                  default: 80 
                },
                source: {
                  type: 'object',
                  properties: {
                    type: { 
                      type: 'string', 
                      enum: ['manual', 'inferred', 'imported'],
                      default: 'manual'
                    },
                    reference: { 
                      type: 'string',
                      default: 'mcp'
                    },
                    context: { type: 'string' }
                  },
                  default: { type: 'manual', reference: 'mcp' }
                }
              },
              required: ['project_path', 'content', 'type'],
            },
          },
          {
            name: 'update_fact',
            description: 'Update an existing fact',
            inputSchema: {
              type: 'object',
              properties: {
                fact_id: { type: 'string', description: 'The ID of the fact to update' },
                content: { type: 'string', description: 'Updated content of the fact' },
                why: { type: 'string', description: 'Updated context or reasoning' },
                type: { 
                  type: 'string', 
                  enum: ['decision', 'assumption', 'constraint', 'requirement', 'risk', 'learning', 'todo', 'other'],
                  description: 'Updated fact type' 
                },
                services: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Updated services list' 
                },
                tags: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Updated tags list' 
                },
                confidence: { 
                  type: 'number', 
                  minimum: 0, 
                  maximum: 100,
                  description: 'Updated confidence level' 
                },
                status: {
                  type: 'string',
                  enum: ['active', 'completed', 'archived'],
                  description: 'Updated status'
                },
                source: {
                  type: 'object',
                  properties: {
                    type: { 
                      type: 'string', 
                      enum: ['manual', 'inferred', 'imported']
                    },
                    reference: { type: 'string' },
                    context: { type: 'string' }
                  }
                }
              },
              required: ['fact_id'],
            },
          },
          {
            name: 'delete_fact',
            description: 'Permanently delete a fact (requires confirmation)',
            inputSchema: {
              type: 'object',
              properties: {
                fact_id: { type: 'string', description: 'The ID of the fact to delete' },
                confirm: { type: 'boolean', description: 'Must be true to confirm deletion' },
              },
              required: ['fact_id', 'confirm'],
            },
          },
          {
            name: 'archive_fact',
            description: 'Archive a fact (soft delete)',
            inputSchema: {
              type: 'object',
              properties: {
                fact_id: { type: 'string', description: 'The ID of the fact to archive' },
              },
              required: ['fact_id'],
            },
          },
          {
            name: 'restore_fact',
            description: 'Restore an archived fact',
            inputSchema: {
              type: 'object',
              properties: {
                fact_id: { type: 'string', description: 'The ID of the fact to restore' },
              },
              required: ['fact_id'],
            },
          },
          {
            name: 'create_relation',
            description: 'Create a relationship between two facts',
            inputSchema: {
              type: 'object',
              properties: {
                from_fact_id: { type: 'string', description: 'The ID of the source fact' },
                to_fact_id: { type: 'string', description: 'The ID of the target fact' },
                type: { 
                  type: 'string', 
                  enum: ['supersedes', 'contradicts', 'supports', 'depends_on', 'relates_to'],
                  description: 'The type of relationship' 
                },
                strength: { 
                  type: 'number', 
                  minimum: 0, 
                  maximum: 1,
                  description: 'Strength of the relationship (0.0-1.0)', 
                  default: 1.0 
                },
                metadata: { type: 'object', description: 'Additional metadata for the relationship' },
              },
              required: ['from_fact_id', 'to_fact_id', 'type'],
            },
          },
          {
            name: 'delete_relation',
            description: 'Delete a relationship between two facts',
            inputSchema: {
              type: 'object',
              properties: {
                from_fact_id: { type: 'string', description: 'The ID of the source fact' },
                to_fact_id: { type: 'string', description: 'The ID of the target fact' },
                type: { 
                  type: 'string', 
                  enum: ['supersedes', 'contradicts', 'supports', 'depends_on', 'relates_to'],
                  description: 'The type of relationship to delete' 
                },
              },
              required: ['from_fact_id', 'to_fact_id', 'type'],
            },
          },
          {
            name: 'list_relations',
            description: 'List all relationships for a fact',
            inputSchema: {
              type: 'object',
              properties: {
                fact_id: { type: 'string', description: 'The ID of the fact to list relationships for' },
                direction: { 
                  type: 'string',
                  enum: ['from', 'to', 'both'],
                  description: 'Direction of relationships to list',
                  default: 'both'
                },
              },
              required: ['fact_id'],
            },
          },
          {
            name: 'get_project_stats',
            description: 'Get detailed statistics about a project',
            inputSchema: {
              type: 'object',
              properties: {
                project_path: { type: 'string', description: 'The project path to get statistics for' },
              },
              required: ['project_path'],
            },
          },
          {
            name: 'semantic_search_facts',
            description: 'Search facts using semantic similarity to find conceptually related facts',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Natural language query to find semantically similar facts' },
                project_path: { type: 'string', description: 'Project path to search in (searches all projects if not specified)' },
                threshold: { type: 'number', description: 'Similarity threshold (0-1, higher is more similar)', default: 0.7, minimum: 0, maximum: 1 },
                limit: { type: 'number', description: 'Maximum number of results', default: 20 },
              },
              required: ['query'],
            },
          },
          {
            name: 'find_similar_facts',
            description: 'Find facts similar to a given fact',
            inputSchema: {
              type: 'object',
              properties: {
                fact_id: { type: 'string', description: 'The ID of the fact to find similar facts for' },
                limit: { type: 'number', description: 'Maximum number of similar facts to return', default: 10 },
                threshold: { type: 'number', description: 'Similarity threshold (0-1)', default: 0.5, minimum: 0, maximum: 1 },
              },
              required: ['fact_id'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'search_facts':
          return this.searchFacts(request.params.arguments);
        case 'list_facts':
          return this.listFacts(request.params.arguments);
        case 'get_fact':
          return this.getFact(request.params.arguments);
        case 'list_projects':
          return this.listProjects(request.params.arguments);
        case 'create_fact':
          return this.createFact(request.params.arguments);
        case 'update_fact':
          return this.updateFact(request.params.arguments);
        case 'delete_fact':
          return this.deleteFact(request.params.arguments);
        case 'archive_fact':
          return this.archiveFact(request.params.arguments);
        case 'restore_fact':
          return this.restoreFact(request.params.arguments);
        case 'create_relation':
          return this.createRelation(request.params.arguments);
        case 'delete_relation':
          return this.deleteRelation(request.params.arguments);
        case 'list_relations':
          return this.listRelations(request.params.arguments);
        case 'get_project_stats':
          return this.getProjectStats(request.params.arguments);
        case 'semantic_search_facts':
          return this.semanticSearchFacts(request.params.arguments);
        case 'find_similar_facts':
          return this.findSimilarFacts(request.params.arguments);
        default:
          throw new Error(`Tool not found: ${request.params.name}`);
      }
    });
  }

  private async searchFacts(args: unknown) {
    const params = SearchFactsSchema.parse(args);
    
    let projectsToSearch = this.db.listProjects();
    let requestedProject = null;
    
    // If specific project requested, filter to just that project
    if (params.project_path) {
      const project = this.db.findProjectByPath(params.project_path);
      if (!project) {
        throw new Error(`Project not found at path: ${params.project_path}`);
      }
      projectsToSearch = [project];
      requestedProject = project;
    }

    // Search across all selected projects
    let allFacts: Array<Fact & { projectName: string; projectPath: string }> = [];
    
    for (const project of projectsToSearch) {
      const facts = this.db.searchFacts(project.id, params.query);
      allFacts.push(...facts.map(f => ({ 
        ...f, 
        projectName: project.name, 
        projectPath: project.path 
      })));
    }

    // Apply filters
    if (params.type) {
      allFacts = allFacts.filter(f => f.type === params.type);
    }

    if (params.service) {
      allFacts = allFacts.filter(f => f.services.includes(params.service!));
    }

    // Sort by date
    allFacts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply limit
    const limit = params.limit || 50;
    if (allFacts.length > limit) {
      allFacts = allFacts.slice(0, limit);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            facts: allFacts.map(f => ({
              ...this.formatFact(f),
              project: {
                name: f.projectName,
                path: f.projectPath,
              },
            })),
            total: allFacts.length,
            searchedProjects: requestedProject ? 1 : projectsToSearch.length,
          }, null, 2),
        },
      ],
    };
  }

  private async listFacts(args: unknown) {
    const params = ListFactsSchema.parse(args);
    
    let projectsToList = this.db.listProjects();
    let requestedProject = null;
    
    // If specific project requested, filter to just that project
    if (params.project_path) {
      const project = this.db.findProjectByPath(params.project_path);
      if (!project) {
        throw new Error(`Project not found at path: ${params.project_path}`);
      }
      projectsToList = [project];
      requestedProject = project;
    }

    // List facts from all selected projects
    let allFacts: Array<Fact & { projectName: string; projectPath: string }> = [];
    
    for (const project of projectsToList) {
      let facts: Fact[];

      if (params.type) {
        facts = this.db.listFactsByType(project.id, params.type as FactType);
      } else if (params.service) {
        facts = this.db.listFactsByService(project.id, params.service);
      } else {
        facts = this.db.listFactsByProject(project.id);
      }
      
      allFacts.push(...facts.map(f => ({ 
        ...f, 
        projectName: project.name, 
        projectPath: project.path 
      })));
    }

    // Sort by creation date descending
    allFacts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply limit
    const limit = params.limit || 20;
    if (allFacts.length > limit) {
      allFacts = allFacts.slice(0, limit);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            facts: allFacts.map(f => ({
              ...this.formatFact(f),
              project: {
                name: f.projectName,
                path: f.projectPath,
              },
            })),
            total: allFacts.length,
            listedProjects: requestedProject ? 1 : projectsToList.length,
          }, null, 2),
        },
      ],
    };
  }

  private async getFact(args: unknown) {
    const params = GetFactSchema.parse(args);
    
    const fact = this.db.getFactById(params.fact_id);
    if (!fact) {
      throw new Error(`Fact not found with ID: ${params.fact_id}`);
    }

    const project = this.db.listProjects().find(p => p.id === fact.projectId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            fact: this.formatFact(fact),
            project: project ? {
              id: project.id,
              name: project.name,
              path: project.path,
            } : undefined,
          }, null, 2),
        },
      ],
    };
  }

  private async listProjects(_args: unknown) {
    const projects = this.db.listProjects();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            projects: projects.map(p => ({
              id: p.id,
              name: p.name,
              path: p.path,
              isMonorepo: p.isMonorepo,
              services: p.services,
              lastSeen: p.lastSeen.toISOString(),
              createdAt: p.createdAt.toISOString(),
              factCount: this.db.listFactsByProject(p.id).length,
            })),
            total: projects.length,
          }, null, 2),
        },
      ],
    };
  }

  private formatFact(fact: Fact) {
    return {
      id: fact.id,
      content: fact.content,
      why: fact.why,
      type: fact.type,
      services: fact.services,
      tags: fact.tags,
      confidence: fact.confidence,
      status: fact.status,
      source: fact.source,
      createdAt: fact.createdAt.toISOString(),
      updatedAt: fact.updatedAt.toISOString(),
    };
  }

  private async createFact(args: unknown) {
    const params = CreateFactSchema.parse(args);
    
    // Find or create the project by path
    let project = this.db.findProjectByPath(params.project_path);
    
    if (!project) {
      // Auto-initialize the project if it doesn't exist
      const projectName = params.project_path.split('/').pop() || 'unknown';
      
      project = this.db.createProject({
        name: projectName,
        path: params.project_path,
        isMonorepo: false,
        services: params.services || [],
      });
    }

    // Create the fact
    const fact = await this.db.createFact({
      projectId: project.id,
      content: params.content,
      why: params.why,
      type: params.type as FactType,
      services: params.services,
      tags: params.tags,
      confidence: params.confidence,
      source: params.source,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            fact: this.formatFact(fact),
            project: {
              id: project.id,
              name: project.name,
              path: project.path,
              created: !project.lastSeen || project.lastSeen.toISOString() === project.createdAt.toISOString(),
            },
            message: !project.lastSeen || project.lastSeen.toISOString() === project.createdAt.toISOString()
              ? 'Project initialized and fact created successfully'
              : 'Fact created successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async updateFact(args: unknown) {
    const params = UpdateFactSchema.parse(args);
    
    // Verify the fact exists before updating
    const existingFact = this.db.getFactById(params.fact_id);
    if (!existingFact) {
      throw new Error(`Fact not found with ID: ${params.fact_id}`);
    }

    // Update the fact
    const updatedFact = this.db.updateFact(params.fact_id, {
      content: params.content,
      why: params.why,
      type: params.type as FactType | undefined,
      services: params.services,
      tags: params.tags,
      confidence: params.confidence,
      status: params.status as any,
      source: params.source,
    });

    if (!updatedFact) {
      throw new Error(`Failed to update fact with ID: ${params.fact_id}`);
    }

    // Get the project for context
    const project = this.db.listProjects().find(p => p.id === updatedFact.projectId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            fact: this.formatFact(updatedFact),
            project: project ? {
              id: project.id,
              name: project.name,
              path: project.path,
            } : undefined,
            message: 'Fact updated successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async deleteFact(args: unknown) {
    const params = DeleteFactSchema.parse(args);
    
    // Require explicit confirmation
    if (!params.confirm) {
      throw new Error('Deletion must be confirmed by setting confirm: true');
    }
    
    // Verify the fact exists before deleting
    const fact = this.db.getFactById(params.fact_id);
    if (!fact) {
      throw new Error(`Fact not found with ID: ${params.fact_id}`);
    }

    // Get the project for context before deletion
    const project = this.db.listProjects().find(p => p.id === fact.projectId);

    // Delete the fact
    this.db.deleteFact(params.fact_id);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            deleted: true,
            fact_id: params.fact_id,
            project: project ? {
              id: project.id,
              name: project.name,
              path: project.path,
            } : undefined,
            message: 'Fact permanently deleted',
          }, null, 2),
        },
      ],
    };
  }

  private async archiveFact(args: unknown) {
    const params = ArchiveFactSchema.parse(args);
    
    // Verify the fact exists before archiving
    const fact = this.db.getFactById(params.fact_id);
    if (!fact) {
      throw new Error(`Fact not found with ID: ${params.fact_id}`);
    }

    // Check if already archived
    if (fact.status === 'archived') {
      throw new Error('Fact is already archived');
    }

    // Archive the fact (soft delete)
    this.db.softDeleteFact(params.fact_id);
    
    // Get the updated fact
    const archivedFact = this.db.getFactById(params.fact_id);
    if (!archivedFact) {
      throw new Error(`Failed to archive fact with ID: ${params.fact_id}`);
    }

    // Get the project for context
    const project = this.db.listProjects().find(p => p.id === archivedFact.projectId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            fact: this.formatFact(archivedFact),
            project: project ? {
              id: project.id,
              name: project.name,
              path: project.path,
            } : undefined,
            message: 'Fact archived successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async restoreFact(args: unknown) {
    const params = RestoreFactSchema.parse(args);
    
    // Verify the fact exists before restoring
    const fact = this.db.getFactById(params.fact_id);
    if (!fact) {
      throw new Error(`Fact not found with ID: ${params.fact_id}`);
    }

    // Check if not archived
    if (fact.status !== 'archived') {
      throw new Error('Fact is not archived');
    }

    // Restore the fact
    this.db.restoreFact(params.fact_id);
    
    // Get the updated fact
    const restoredFact = this.db.getFactById(params.fact_id);
    if (!restoredFact) {
      throw new Error(`Failed to restore fact with ID: ${params.fact_id}`);
    }

    // Get the project for context
    const project = this.db.listProjects().find(p => p.id === restoredFact.projectId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            fact: this.formatFact(restoredFact),
            project: project ? {
              id: project.id,
              name: project.name,
              path: project.path,
            } : undefined,
            message: 'Fact restored successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async createRelation(args: unknown) {
    const params = CreateRelationSchema.parse(args);
    
    // Verify both facts exist
    const fromFact = this.db.getFactById(params.from_fact_id);
    if (!fromFact) {
      throw new Error(`Source fact not found with ID: ${params.from_fact_id}`);
    }
    
    const toFact = this.db.getFactById(params.to_fact_id);
    if (!toFact) {
      throw new Error(`Target fact not found with ID: ${params.to_fact_id}`);
    }
    
    // Verify facts are in the same project
    if (fromFact.projectId !== toFact.projectId) {
      throw new Error('Cannot create relation between facts in different projects');
    }
    
    // Create the relation
    const relation = this.db.createRelation({
      fromFactId: params.from_fact_id,
      toFactId: params.to_fact_id,
      type: params.type as RelationType,
      strength: params.strength,
      metadata: params.metadata,
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            relation: {
              fromFactId: relation.fromFactId,
              toFactId: relation.toFactId,
              type: relation.type,
              strength: relation.strength,
              metadata: relation.metadata,
              createdAt: relation.createdAt.toISOString(),
            },
            fromFact: {
              id: fromFact.id,
              content: fromFact.content,
            },
            toFact: {
              id: toFact.id,
              content: toFact.content,
            },
            message: 'Relation created successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async deleteRelation(args: unknown) {
    const params = DeleteRelationSchema.parse(args);
    
    // Verify the relation exists by checking if the facts exist
    const fromFact = this.db.getFactById(params.from_fact_id);
    if (!fromFact) {
      throw new Error(`Source fact not found with ID: ${params.from_fact_id}`);
    }
    
    const toFact = this.db.getFactById(params.to_fact_id);
    if (!toFact) {
      throw new Error(`Target fact not found with ID: ${params.to_fact_id}`);
    }
    
    // Delete the relation
    this.db.deleteRelation(params.from_fact_id, params.to_fact_id, params.type);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            deleted: true,
            fromFactId: params.from_fact_id,
            toFactId: params.to_fact_id,
            type: params.type,
            message: 'Relation deleted successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async listRelations(args: unknown) {
    const params = ListRelationsSchema.parse(args);
    
    // Verify the fact exists
    const fact = this.db.getFactById(params.fact_id);
    if (!fact) {
      throw new Error(`Fact not found with ID: ${params.fact_id}`);
    }
    
    // Get all relations for the fact
    const allRelations = this.db.listRelationsByFact(params.fact_id);
    
    // Filter by direction
    let relations = allRelations;
    if (params.direction === 'from') {
      relations = allRelations.filter(r => r.fromFactId === params.fact_id);
    } else if (params.direction === 'to') {
      relations = allRelations.filter(r => r.toFactId === params.fact_id);
    }
    
    // Get fact details for related facts
    const relatedFactIds = new Set<string>();
    relations.forEach(r => {
      if (r.fromFactId !== params.fact_id) relatedFactIds.add(r.fromFactId);
      if (r.toFactId !== params.fact_id) relatedFactIds.add(r.toFactId);
    });
    
    const relatedFacts = new Map<string, any>();
    for (const factId of relatedFactIds) {
      const relatedFact = this.db.getFactById(factId);
      if (relatedFact) {
        relatedFacts.set(factId, {
          id: relatedFact.id,
          content: relatedFact.content,
          type: relatedFact.type,
        });
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            fact: {
              id: fact.id,
              content: fact.content,
              type: fact.type,
            },
            relations: relations.map(r => ({
              fromFactId: r.fromFactId,
              toFactId: r.toFactId,
              type: r.type,
              strength: r.strength,
              metadata: r.metadata,
              createdAt: r.createdAt.toISOString(),
              direction: r.fromFactId === params.fact_id ? 'outgoing' : 'incoming',
              relatedFact: relatedFacts.get(r.fromFactId === params.fact_id ? r.toFactId : r.fromFactId),
            })),
            total: relations.length,
            direction: params.direction,
          }, null, 2),
        },
      ],
    };
  }

  private async getProjectStats(args: unknown) {
    const params = GetProjectStatsSchema.parse(args);
    
    // Find the project by path
    const project = this.db.findProjectByPath(params.project_path);
    if (!project) {
      throw new Error(`Project not found at path: ${params.project_path}`);
    }
    
    // Get all facts for the project
    const allFacts = this.db.listFactsByProject(project.id);
    
    // Calculate statistics
    const stats = {
      totalFacts: allFacts.length,
      factsByType: {} as Record<FactType, number>,
      factsByStatus: {} as Record<string, number>,
      factsByService: {} as Record<string, number>,
      averageConfidence: 0,
      highConfidenceFacts: 0,
      lowConfidenceFacts: 0,
      recentFacts: [] as any[],
      factGrowth: {
        lastWeek: 0,
        lastMonth: 0,
        lastQuarter: 0,
      },
      topTags: [] as { tag: string; count: number }[],
      relationStats: {
        totalRelations: 0,
        byType: {} as Record<string, number>,
      },
    };
    
    // Count facts by type
    for (const type of ['decision', 'assumption', 'constraint', 'requirement', 'risk', 'learning', 'todo', 'other'] as FactType[]) {
      stats.factsByType[type] = 0;
    }
    
    // Count facts by status
    for (const status of ['active', 'completed', 'archived']) {
      stats.factsByStatus[status] = 0;
    }
    
    // Tag frequency map
    const tagFrequency = new Map<string, number>();
    
    // Time boundaries for growth metrics
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    let totalConfidence = 0;
    
    // Process facts
    for (const fact of allFacts) {
      // Type counts
      stats.factsByType[fact.type]++;
      
      // Status counts
      const status = fact.status || 'active';
      if (!(status in stats.factsByStatus)) {
        stats.factsByStatus[status] = 0;
      }
      stats.factsByStatus[status]!++;
      
      // Service counts
      for (const service of fact.services) {
        stats.factsByService[service] = (stats.factsByService[service] || 0) + 1;
      }
      
      // Confidence metrics
      totalConfidence += fact.confidence;
      if (fact.confidence >= 90) stats.highConfidenceFacts++;
      if (fact.confidence < 50) stats.lowConfidenceFacts++;
      
      // Tag frequency
      for (const tag of fact.tags) {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
      }
      
      // Growth metrics
      if (fact.createdAt >= oneWeekAgo) stats.factGrowth.lastWeek++;
      if (fact.createdAt >= oneMonthAgo) stats.factGrowth.lastMonth++;
      if (fact.createdAt >= threeMonthsAgo) stats.factGrowth.lastQuarter++;
    }
    
    // Calculate averages
    if (allFacts.length > 0) {
      stats.averageConfidence = Math.round(totalConfidence / allFacts.length);
    }
    
    // Get top 10 tags
    const sortedTags = Array.from(tagFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
    stats.topTags = sortedTags;
    
    // Get 5 most recent facts
    stats.recentFacts = allFacts
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map(f => ({
        id: f.id,
        content: f.content,
        type: f.type,
        createdAt: f.createdAt.toISOString(),
      }));
    
    // Get relation statistics
    const allRelations = [];
    for (const fact of allFacts) {
      const relations = this.db.listRelationsByFact(fact.id);
      allRelations.push(...relations);
    }
    
    // Deduplicate relations (since we're getting both directions)
    const uniqueRelations = new Map<string, any>();
    for (const rel of allRelations) {
      const key = `${rel.fromFactId}-${rel.toFactId}-${rel.type}`;
      uniqueRelations.set(key, rel);
    }
    
    stats.relationStats.totalRelations = uniqueRelations.size;
    for (const rel of uniqueRelations.values()) {
      stats.relationStats.byType[rel.type] = (stats.relationStats.byType[rel.type] || 0) + 1;
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            project: {
              id: project.id,
              name: project.name,
              path: project.path,
              isMonorepo: project.isMonorepo,
              services: project.services,
              createdAt: project.createdAt.toISOString(),
              lastSeen: project.lastSeen.toISOString(),
            },
            statistics: stats,
          }, null, 2),
        },
      ],
    };
  }

  private async semanticSearchFacts(args: unknown) {
    const params = SemanticSearchFactsSchema.parse(args);
    
    try {
      // Perform semantic search
      const results = await this.db.semanticSearchFacts(params.query, {
        projectId: params.project_path ? this.db.findProjectByPath(params.project_path)?.id : undefined,
        threshold: params.threshold,
        limit: params.limit,
        includeScore: true
      });
      
      // Enrich results with project information
      const enrichedResults = results.map(fact => {
        const project = this.db.listProjects().find(p => p.id === fact.projectId);
        return {
          ...this.formatFact(fact),
          similarity: fact.similarity,
          project: project ? {
            name: project.name,
            path: project.path,
          } : undefined,
        };
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              facts: enrichedResults,
              total: enrichedResults.length,
              query: params.query,
              searchType: 'semantic',
              threshold: params.threshold,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      // Fallback to regular search if semantic search fails
      console.error('Semantic search failed, falling back to keyword search:', error);
      return this.searchFacts({
        query: params.query,
        project_path: params.project_path,
        limit: params.limit,
      });
    }
  }

  private async findSimilarFacts(args: unknown) {
    const params = FindSimilarFactsSchema.parse(args);
    
    // Verify the fact exists
    const fact = this.db.getFactById(params.fact_id);
    if (!fact) {
      throw new Error(`Fact not found with ID: ${params.fact_id}`);
    }
    
    try {
      // Find similar facts
      const similarFacts = await this.db.findSimilarFacts(params.fact_id, {
        limit: params.limit,
        threshold: params.threshold
      });
      
      // Enrich results with project information
      const enrichedResults = similarFacts.map(similarFact => {
        const project = this.db.listProjects().find(p => p.id === similarFact.projectId);
        return {
          ...this.formatFact(similarFact),
          similarity: similarFact.similarity,
          project: project ? {
            name: project.name,
            path: project.path,
          } : undefined,
        };
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              originalFact: {
                ...this.formatFact(fact),
                project: this.db.listProjects().find(p => p.id === fact.projectId)?.name,
              },
              similarFacts: enrichedResults,
              total: enrichedResults.length,
              threshold: params.threshold,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Finding similar facts failed:', error);
      throw new Error(`Failed to find similar facts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getServerInfo() {
    return {
      name: 'lorehub',
      version: '0.1.0',
      capabilities: {
        tools: {},
      },
    };
  }

  async listTools() {
    // Return the tools directly for testing
    return [
      {
        name: 'search_facts',
        description: 'Search facts across all projects with optional filters',
      },
      {
        name: 'list_facts',
        description: 'List facts from all projects with optional filters',
      },
      {
        name: 'get_fact',
        description: 'Get a specific fact by ID',
      },
      {
        name: 'list_projects',
        description: 'List all projects in the LoreHub database',
      },
      {
        name: 'create_fact',
        description: 'Create a new fact in a project',
      },
      {
        name: 'update_fact',
        description: 'Update an existing fact',
      },
      {
        name: 'delete_fact',
        description: 'Permanently delete a fact (requires confirmation)',
      },
      {
        name: 'archive_fact',
        description: 'Archive a fact (soft delete)',
      },
      {
        name: 'restore_fact',
        description: 'Restore an archived fact',
      },
      {
        name: 'create_relation',
        description: 'Create a relationship between two facts',
      },
      {
        name: 'delete_relation',
        description: 'Delete a relationship between two facts',
      },
      {
        name: 'list_relations',
        description: 'List all relationships for a fact',
      },
      {
        name: 'get_project_stats',
        description: 'Get detailed statistics about a project',
      },
      {
        name: 'semantic_search_facts',
        description: 'Search facts using semantic similarity to find conceptually related facts',
      },
      {
        name: 'find_similar_facts',
        description: 'Find facts similar to a given fact',
      },
    ];
  }

  async callTool(name: string, args: any) {
    // Direct implementation for testing
    switch (name) {
      case 'search_facts':
        const searchResult = await this.searchFacts(args);
        return JSON.parse(searchResult.content[0]!.text!);
      case 'list_facts':
        const listResult = await this.listFacts(args);
        return JSON.parse(listResult.content[0]!.text!);
      case 'get_fact':
        const getResult = await this.getFact(args);
        return JSON.parse(getResult.content[0]!.text!);
      case 'list_projects':
        const projectsResult = await this.listProjects(args);
        return JSON.parse(projectsResult.content[0]!.text!);
      case 'create_fact':
        const createResult = await this.createFact(args);
        return JSON.parse(createResult.content[0]!.text!);
      case 'update_fact':
        const updateResult = await this.updateFact(args);
        return JSON.parse(updateResult.content[0]!.text!);
      case 'delete_fact':
        const deleteResult = await this.deleteFact(args);
        return JSON.parse(deleteResult.content[0]!.text!);
      case 'archive_fact':
        const archiveResult = await this.archiveFact(args);
        return JSON.parse(archiveResult.content[0]!.text!);
      case 'restore_fact':
        const restoreResult = await this.restoreFact(args);
        return JSON.parse(restoreResult.content[0]!.text!);
      case 'create_relation':
        const createRelResult = await this.createRelation(args);
        return JSON.parse(createRelResult.content[0]!.text!);
      case 'delete_relation':
        const deleteRelResult = await this.deleteRelation(args);
        return JSON.parse(deleteRelResult.content[0]!.text!);
      case 'list_relations':
        const listRelResult = await this.listRelations(args);
        return JSON.parse(listRelResult.content[0]!.text!);
      case 'get_project_stats':
        const statsResult = await this.getProjectStats(args);
        return JSON.parse(statsResult.content[0]!.text!);
      case 'semantic_search_facts':
        const semanticResult = await this.semanticSearchFacts(args);
        return JSON.parse(semanticResult.content[0]!.text!);
      case 'find_similar_facts':
        const similarResult = await this.findSimilarFacts(args);
        return JSON.parse(similarResult.content[0]!.text!);
      default:
        throw new Error(`Tool not found: ${name}`);
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('LoreHub MCP server started');
  }

  close() {
    this.db.close();
  }
}