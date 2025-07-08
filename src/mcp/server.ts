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
import type { Fact, FactType } from '../core/types.js';

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