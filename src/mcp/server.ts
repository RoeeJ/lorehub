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
import type { Lore, LoreType, RelationType } from '../core/types.js';

// Tool schemas
const SearchLoresSchema = z.object({
  query: z.string().describe('Search query (supports wildcards * and ?)'),
  realm_path: z.string().optional().describe('Realm path to search in (searches all realms if not specified)'),
  type: z.enum(['decree', 'wisdom', 'belief', 'constraint', 'requirement', 'risk', 'quest', 'saga', 'story', 'anomaly', 'other']).optional(),
  province: z.string().optional().describe('Filter by province (service in monorepos)'),
  limit: z.number().optional().default(50).describe('Maximum number of results'),
});

const ListLoresSchema = z.object({
  realm_path: z.string().optional().describe('Realm path to list lores from (lists from all realms if not specified)'),
  type: z.enum(['decree', 'wisdom', 'belief', 'constraint', 'requirement', 'risk', 'quest', 'saga', 'story', 'anomaly', 'other']).optional(),
  province: z.string().optional().describe('Filter by province (service in monorepos)'),
  limit: z.number().optional().default(20).describe('Maximum number of results'),
});

const GetLoreSchema = z.object({
  lore_id: z.string().describe('The ID of the lore to retrieve'),
});

const ListRealmsSchema = z.object({});

const CreateLoreSchema = z.object({
  realm_path: z.string().describe('Realm path where the lore should be created'),
  content: z.string().describe('The main content of the lore'),
  why: z.string().optional().describe('Additional context or reasoning for this lore'),
  type: z.enum(['decree', 'wisdom', 'belief', 'constraint', 'requirement', 'risk', 'quest', 'saga', 'story', 'anomaly', 'other']).describe('The type of lore'),
  provinces: z.array(z.string()).optional().describe('Provinces this lore applies to (services in monorepos)'),
  sigils: z.array(z.string()).optional().describe('Sigils for categorizing the lore (tags)'),
  confidence: z.number().min(0).max(100).optional().default(80).describe('Confidence level (0-100)'),
  origin: z.object({
    type: z.enum(['manual', 'inferred', 'imported']).default('manual'),
    reference: z.string().default('mcp'),
    context: z.string().optional(),
  }).optional().default({ type: 'manual', reference: 'mcp' }),
});

const UpdateLoreSchema = z.object({
  lore_id: z.string().describe('The ID of the lore to update'),
  content: z.string().optional().describe('Updated content of the lore'),
  why: z.string().optional().describe('Updated context or reasoning'),
  type: z.enum(['decree', 'wisdom', 'belief', 'constraint', 'requirement', 'risk', 'quest', 'saga', 'story', 'anomaly', 'other']).optional(),
  provinces: z.array(z.string()).optional().describe('Updated provinces list'),
  sigils: z.array(z.string()).optional().describe('Updated sigils list'),
  confidence: z.number().min(0).max(100).optional().describe('Updated confidence level'),
  status: z.enum(['living', 'ancient', 'whispered', 'proclaimed', 'archived']).optional().describe('Updated status'),
  origin: z.object({
    type: z.enum(['manual', 'inferred', 'imported']),
    reference: z.string(),
    context: z.string().optional(),
  }).optional(),
});

const DeleteLoreSchema = z.object({
  lore_id: z.string().describe('The ID of the lore to delete'),
  confirm: z.boolean().describe('Must be true to confirm deletion'),
});

const ArchiveLoreSchema = z.object({
  lore_id: z.string().describe('The ID of the lore to archive'),
});

const RestoreLoreSchema = z.object({
  lore_id: z.string().describe('The ID of the lore to restore'),
});

const CreateRelationSchema = z.object({
  from_lore_id: z.string().describe('The ID of the source lore'),
  to_lore_id: z.string().describe('The ID of the target lore'),
  type: z.enum(['succeeds', 'challenges', 'supports', 'depends_on', 'bound_to']).describe('The type of relationship'),
  strength: z.number().min(0).max(1).optional().default(1.0).describe('Strength of the relationship (0.0-1.0)'),
  metadata: z.record(z.unknown()).optional().describe('Additional metadata for the relationship'),
});

const DeleteRelationSchema = z.object({
  from_lore_id: z.string().describe('The ID of the source lore'),
  to_lore_id: z.string().describe('The ID of the target lore'),
  type: z.enum(['supersedes', 'contradicts', 'supports', 'depends_on', 'relates_to']).describe('The type of relationship to delete'),
});

const ListRelationsSchema = z.object({
  lore_id: z.string().describe('The ID of the lore to list relationships for'),
  direction: z.enum(['from', 'to', 'both']).optional().default('both').describe('Direction of relationships to list'),
});

const GetRealmStatsSchema = z.object({
  realm_path: z.string().describe('The realm path to get statistics for'),
});

const SemanticSearchLoresSchema = z.object({
  query: z.string().describe('Natural language query to find semantically similar lores'),
  realm_path: z.string().optional().describe('Realm path to search in (searches all realms if not specified)'),
  threshold: z.number().min(0).max(1).optional().default(0.7).describe('Similarity threshold (0-1, higher is more similar)'),
  limit: z.number().optional().default(20).describe('Maximum number of results'),
});

const FindSimilarLoresSchema = z.object({
  lore_id: z.string().describe('The ID of the lore to find similar lores for'),
  limit: z.number().optional().default(10).describe('Maximum number of similar lores to return'),
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
            name: 'search_lores',
            description: 'Search lores across all realms with optional filters',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query (supports wildcards * and ?)' },
                realm_path: { type: 'string', description: 'Realm path to search in (searches all realms if not specified)' },
                type: { 
                  type: 'string', 
                  enum: ['decree', 'assumption', 'constraint', 'requirement', 'risk', 'lesson', 'quest', 'other'],
                  description: 'Filter by lore type' 
                },
                province: { type: 'string', description: 'Filter by province (for monorepos)' },
                limit: { type: 'number', description: 'Maximum number of results', default: 50 },
              },
              required: ['query'],
            },
          },
          {
            name: 'list_lores',
            description: 'List lores from all realms with optional filters',
            inputSchema: {
              type: 'object',
              properties: {
                realm_path: { type: 'string', description: 'Realm path to list lores from (lists from all realms if not specified)' },
                type: { 
                  type: 'string', 
                  enum: ['decree', 'assumption', 'constraint', 'requirement', 'risk', 'lesson', 'quest', 'other'],
                  description: 'Filter by lore type' 
                },
                province: { type: 'string', description: 'Filter by province (for monorepos)' },
                limit: { type: 'number', description: 'Maximum number of results', default: 20 },
              },
              required: [],
            },
          },
          {
            name: 'get_lore',
            description: 'Get a specific lore by ID',
            inputSchema: {
              type: 'object',
              properties: {
                lore_id: { type: 'string', description: 'The ID of the lore to retrieve' },
              },
              required: ['lore_id'],
            },
          },
          {
            name: 'list_realms',
            description: 'List all realms in the LoreHub database',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'create_lore',
            description: 'Create a new lore in a realm',
            inputSchema: {
              type: 'object',
              properties: {
                realm_path: { type: 'string', description: 'Realm path where the lore should be created' },
                content: { type: 'string', description: 'The main content of the lore' },
                why: { type: 'string', description: 'Additional context or reasoning for this lore' },
                type: { 
                  type: 'string', 
                  enum: ['decree', 'assumption', 'constraint', 'requirement', 'risk', 'lesson', 'quest', 'other'],
                  description: 'The type of lore' 
                },
                provinces: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Provinces this lore applies to (for monorepos)' 
                },
                sigils: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Sigils for categorizing the lore' 
                },
                confidence: { 
                  type: 'number', 
                  minimum: 0, 
                  maximum: 100,
                  description: 'Confidence level (0-100)', 
                  default: 80 
                },
                origin: {
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
              required: ['realm_path', 'content', 'type'],
            },
          },
          {
            name: 'update_lore',
            description: 'Update an existing lore',
            inputSchema: {
              type: 'object',
              properties: {
                lore_id: { type: 'string', description: 'The ID of the lore to update' },
                content: { type: 'string', description: 'Updated content of the lore' },
                why: { type: 'string', description: 'Updated context or reasoning' },
                type: { 
                  type: 'string', 
                  enum: ['decree', 'assumption', 'constraint', 'requirement', 'risk', 'lesson', 'quest', 'other'],
                  description: 'Updated lore type' 
                },
                provinces: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Updated provinces list' 
                },
                sigils: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Updated sigils list' 
                },
                confidence: { 
                  type: 'number', 
                  minimum: 0, 
                  maximum: 100,
                  description: 'Updated confidence level' 
                },
                status: {
                  type: 'string',
                  enum: ['living', 'ancient', 'whispered', 'proclaimed', 'archived'],
                  description: 'Updated status'
                },
                origin: {
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
              required: ['lore_id'],
            },
          },
          {
            name: 'delete_lore',
            description: 'Permanently delete a lore (requires confirmation)',
            inputSchema: {
              type: 'object',
              properties: {
                lore_id: { type: 'string', description: 'The ID of the lore to delete' },
                confirm: { type: 'boolean', description: 'Must be true to confirm deletion' },
              },
              required: ['lore_id', 'confirm'],
            },
          },
          {
            name: 'archive_lore',
            description: 'Archive a lore (soft delete)',
            inputSchema: {
              type: 'object',
              properties: {
                lore_id: { type: 'string', description: 'The ID of the lore to archive' },
              },
              required: ['lore_id'],
            },
          },
          {
            name: 'restore_lore',
            description: 'Restore an archived lore',
            inputSchema: {
              type: 'object',
              properties: {
                lore_id: { type: 'string', description: 'The ID of the lore to restore' },
              },
              required: ['lore_id'],
            },
          },
          {
            name: 'create_relation',
            description: 'Create a relationship between two lores',
            inputSchema: {
              type: 'object',
              properties: {
                from_lore_id: { type: 'string', description: 'The ID of the source lore' },
                to_lore_id: { type: 'string', description: 'The ID of the target lore' },
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
              required: ['from_lore_id', 'to_lore_id', 'type'],
            },
          },
          {
            name: 'delete_relation',
            description: 'Delete a relationship between two lores',
            inputSchema: {
              type: 'object',
              properties: {
                from_lore_id: { type: 'string', description: 'The ID of the source lore' },
                to_lore_id: { type: 'string', description: 'The ID of the target lore' },
                type: { 
                  type: 'string', 
                  enum: ['supersedes', 'contradicts', 'supports', 'depends_on', 'relates_to'],
                  description: 'The type of relationship to delete' 
                },
              },
              required: ['from_lore_id', 'to_lore_id', 'type'],
            },
          },
          {
            name: 'list_relations',
            description: 'List all relationships for a lore',
            inputSchema: {
              type: 'object',
              properties: {
                lore_id: { type: 'string', description: 'The ID of the lore to list relationships for' },
                direction: { 
                  type: 'string',
                  enum: ['from', 'to', 'both'],
                  description: 'Direction of relationships to list',
                  default: 'both'
                },
              },
              required: ['lore_id'],
            },
          },
          {
            name: 'get_realm_stats',
            description: 'Get detailed statistics about a realm',
            inputSchema: {
              type: 'object',
              properties: {
                realm_path: { type: 'string', description: 'The realm path to get statistics for' },
              },
              required: ['realm_path'],
            },
          },
          {
            name: 'semantic_search_lores',
            description: 'Search lores using semantic similarity to find conceptually related lores',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Natural language query to find semantically similar lores' },
                realm_path: { type: 'string', description: 'Realm path to search in (searches all realms if not specified)' },
                threshold: { type: 'number', description: 'Similarity threshold (0-1, higher is more similar)', default: 0.7, minimum: 0, maximum: 1 },
                limit: { type: 'number', description: 'Maximum number of results', default: 20 },
              },
              required: ['query'],
            },
          },
          {
            name: 'find_similar_lores',
            description: 'Find lores similar to a given lore',
            inputSchema: {
              type: 'object',
              properties: {
                lore_id: { type: 'string', description: 'The ID of the lore to find similar lores for' },
                limit: { type: 'number', description: 'Maximum number of similar lores to return', default: 10 },
                threshold: { type: 'number', description: 'Similarity threshold (0-1)', default: 0.5, minimum: 0, maximum: 1 },
              },
              required: ['lore_id'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'search_lores':
          return this.searchLores(request.params.arguments);
        case 'list_lores':
          return this.listLores(request.params.arguments);
        case 'get_lore':
          return this.getLore(request.params.arguments);
        case 'list_realms':
          return this.listRealms(request.params.arguments);
        case 'create_lore':
          return this.createLore(request.params.arguments);
        case 'update_lore':
          return this.updateLore(request.params.arguments);
        case 'delete_lore':
          return this.deleteLore(request.params.arguments);
        case 'archive_lore':
          return this.archiveLore(request.params.arguments);
        case 'restore_lore':
          return this.restoreLore(request.params.arguments);
        case 'create_relation':
          return this.createRelation(request.params.arguments);
        case 'delete_relation':
          return this.deleteRelation(request.params.arguments);
        case 'list_relations':
          return this.listRelations(request.params.arguments);
        case 'get_realm_stats':
          return this.getRealmStats(request.params.arguments);
        case 'semantic_search_lores':
          return this.semanticSearchLores(request.params.arguments);
        case 'find_similar_lores':
          return this.findSimilarLores(request.params.arguments);
        default:
          throw new Error(`Tool not found: ${request.params.name}`);
      }
    });
  }

  private async searchLores(args: unknown) {
    const params = SearchLoresSchema.parse(args);
    
    let realmsToSearch = this.db.listRealms();
    let requestedRealm = null;
    
    // If specific realm requested, filter to just that realm
    if (params.realm_path) {
      const realm = this.db.findRealmByPath(params.realm_path);
      if (!realm) {
        throw new Error(`Realm not found at path: ${params.realm_path}`);
      }
      realmsToSearch = [realm];
      requestedRealm = realm;
    }

    // Search across all selected realms
    let allLores: Array<Lore & { realmName: string; realmPath: string }> = [];
    
    for (const realm of realmsToSearch) {
      const lores = this.db.searchLores(realm.id, params.query);
      allLores.push(...lores.map(l => ({ 
        ...l, 
        realmName: realm.name, 
        realmPath: realm.path 
      })));
    }

    // Apply filters
    if (params.type) {
      allLores = allLores.filter(l => l.type === params.type);
    }

    if (params.province) {
      allLores = allLores.filter(l => l.provinces.includes(params.province!));
    }

    // Sort by date
    allLores.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply limit
    const limit = params.limit || 50;
    if (allLores.length > limit) {
      allLores = allLores.slice(0, limit);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            lores: allLores.map(l => ({
              ...this.formatLore(l),
              realm: {
                name: l.realmName,
                path: l.realmPath,
              },
            })),
            total: allLores.length,
            searchedRealms: requestedRealm ? 1 : realmsToSearch.length,
          }, null, 2),
        },
      ],
    };
  }

  private async listLores(args: unknown) {
    const params = ListLoresSchema.parse(args);
    
    let realmsToList = this.db.listRealms();
    let requestedRealm = null;
    
    // If specific realm requested, filter to just that realm
    if (params.realm_path) {
      const realm = this.db.findRealmByPath(params.realm_path);
      if (!realm) {
        throw new Error(`Realm not found at path: ${params.realm_path}`);
      }
      realmsToList = [realm];
      requestedRealm = realm;
    }

    // List lores from all selected realms
    let allLores: Array<Lore & { realmName: string; realmPath: string }> = [];
    
    for (const realm of realmsToList) {
      let lores: Lore[];

      if (params.type) {
        lores = this.db.listLoresByType(realm.id, params.type as LoreType);
      } else if (params.province) {
        lores = this.db.listLoresByProvince(realm.id, params.province);
      } else {
        lores = this.db.listLoresByRealm(realm.id);
      }
      
      allLores.push(...lores.map(l => ({ 
        ...l, 
        realmName: realm.name, 
        realmPath: realm.path 
      })));
    }

    // Sort by creation date descending
    allLores.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply limit
    const limit = params.limit || 20;
    if (allLores.length > limit) {
      allLores = allLores.slice(0, limit);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            lores: allLores.map(l => ({
              ...this.formatLore(l),
              realm: {
                name: l.realmName,
                path: l.realmPath,
              },
            })),
            total: allLores.length,
            listedRealms: requestedRealm ? 1 : realmsToList.length,
          }, null, 2),
        },
      ],
    };
  }

  private async getLore(args: unknown) {
    const params = GetLoreSchema.parse(args);
    
    const lore = this.db.findLore(params.lore_id);
    if (!lore) {
      throw new Error(`Lore not found with ID: ${params.lore_id}`);
    }

    const realm = this.db.listRealms().find(r => r.id === lore.realmId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            lore: this.formatLore(lore),
            realm: realm ? {
              id: realm.id,
              name: realm.name,
              path: realm.path,
            } : undefined,
          }, null, 2),
        },
      ],
    };
  }

  private async listRealms(_args: unknown) {
    const realms = this.db.listRealms();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            realms: realms.map(r => ({
              id: r.id,
              name: r.name,
              path: r.path,
              isMonorepo: r.isMonorepo,
              provinces: r.provinces,
              lastSeen: r.lastSeen.toISOString(),
              createdAt: r.createdAt.toISOString(),
              loreCount: this.db.getRealmLoreCount(r.id),
            })),
            total: realms.length,
          }, null, 2),
        },
      ],
    };
  }

  private formatLore(lore: Lore) {
    return {
      id: lore.id,
      content: lore.content,
      why: lore.why,
      type: lore.type,
      provinces: lore.provinces,
      sigils: lore.sigils,
      confidence: lore.confidence,
      status: lore.status,
      origin: lore.origin,
      createdAt: lore.createdAt.toISOString(),
      updatedAt: lore.updatedAt.toISOString(),
    };
  }

  private async createLore(args: unknown) {
    const params = CreateLoreSchema.parse(args);
    
    // Find or create the realm by path
    let realm = this.db.findRealmByPath(params.realm_path);
    
    if (!realm) {
      // Auto-initialize the realm if it doesn't exist
      const realmName = params.realm_path.split('/').pop() || 'unknown';
      
      realm = this.db.createRealm({
        name: realmName,
        path: params.realm_path,
        isMonorepo: false,
        provinces: params.provinces || [],
      });
    }

    // Create the lore
    const lore = await this.db.createLore({
      realmId: realm.id,
      content: params.content,
      why: params.why,
      type: params.type as LoreType,
      provinces: params.provinces,
      sigils: params.sigils,
      confidence: params.confidence,
      origin: params.origin,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            lore: this.formatLore(lore),
            realm: {
              id: realm.id,
              name: realm.name,
              path: realm.path,
              created: !realm.lastSeen || realm.lastSeen.toISOString() === realm.createdAt.toISOString(),
            },
            message: !realm.lastSeen || realm.lastSeen.toISOString() === realm.createdAt.toISOString()
              ? 'Realm initialized and lore created successfully'
              : 'Lore created successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async updateLore(args: unknown) {
    const params = UpdateLoreSchema.parse(args);
    
    // Verify the lore exists before updating
    const existingLore = this.db.findLore(params.lore_id);
    if (!existingLore) {
      throw new Error(`Lore not found with ID: ${params.lore_id}`);
    }

    // Update the lore
    const updatedLore = this.db.updateLore(params.lore_id, {
      content: params.content,
      why: params.why,
      type: params.type as LoreType | undefined,
      provinces: params.provinces,
      sigils: params.sigils,
      confidence: params.confidence,
      status: params.status as any,
      origin: params.origin,
    });

    if (!updatedLore) {
      throw new Error(`Failed to update lore with ID: ${params.lore_id}`);
    }

    // Get the realm for context
    const realm = this.db.listRealms().find(r => r.id === updatedLore.realmId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            lore: this.formatLore(updatedLore),
            realm: realm ? {
              id: realm.id,
              name: realm.name,
              path: realm.path,
            } : undefined,
            message: 'Lore updated successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async deleteLore(args: unknown) {
    const params = DeleteLoreSchema.parse(args);
    
    // Require explicit confirmation
    if (!params.confirm) {
      throw new Error('Deletion must be confirmed by setting confirm: true');
    }
    
    // Verify the lore exists before deleting
    const lore = this.db.findLore(params.lore_id);
    if (!lore) {
      throw new Error(`Lore not found with ID: ${params.lore_id}`);
    }

    // Get the realm for context before deletion
    const realm = this.db.listRealms().find(r => r.id === lore.realmId);

    // Delete the lore
    this.db.deleteLore(params.lore_id);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            deleted: true,
            lore_id: params.lore_id,
            realm: realm ? {
              id: realm.id,
              name: realm.name,
              path: realm.path,
            } : undefined,
            message: 'Lore permanently deleted',
          }, null, 2),
        },
      ],
    };
  }

  private async archiveLore(args: unknown) {
    const params = ArchiveLoreSchema.parse(args);
    
    // Verify the lore exists before archiving
    const lore = this.db.findLore(params.lore_id);
    if (!lore) {
      throw new Error(`Lore not found with ID: ${params.lore_id}`);
    }

    // Check if already archived
    if (lore.status === 'archived') {
      throw new Error('Lore is already archived');
    }

    // Archive the lore (soft delete)
    this.db.softDeleteLore(params.lore_id);
    
    // Get the updated lore
    const archivedLore = this.db.findLore(params.lore_id);
    if (!archivedLore) {
      throw new Error(`Failed to archive lore with ID: ${params.lore_id}`);
    }

    // Get the realm for context
    const realm = this.db.listRealms().find(r => r.id === archivedLore.realmId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            lore: this.formatLore(archivedLore),
            realm: realm ? {
              id: realm.id,
              name: realm.name,
              path: realm.path,
            } : undefined,
            message: 'Lore archived successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async restoreLore(args: unknown) {
    const params = RestoreLoreSchema.parse(args);
    
    // Verify the lore exists before restoring
    const lore = this.db.findLore(params.lore_id);
    if (!lore) {
      throw new Error(`Lore not found with ID: ${params.lore_id}`);
    }

    // Check if not archived
    if (lore.status !== 'archived') {
      throw new Error('Lore is not archived');
    }

    // Restore the lore
    this.db.restoreLore(params.lore_id);
    
    // Get the updated lore
    const restoredLore = this.db.findLore(params.lore_id);
    if (!restoredLore) {
      throw new Error(`Failed to restore lore with ID: ${params.lore_id}`);
    }

    // Get the realm for context
    const realm = this.db.listRealms().find(r => r.id === restoredLore.realmId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            lore: this.formatLore(restoredLore),
            realm: realm ? {
              id: realm.id,
              name: realm.name,
              path: realm.path,
            } : undefined,
            message: 'Lore restored successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async createRelation(args: unknown) {
    const params = CreateRelationSchema.parse(args);
    
    // Verify both lores exist
    const fromLore = this.db.findLore(params.from_lore_id);
    if (!fromLore) {
      throw new Error(`Source lore not found with ID: ${params.from_lore_id}`);
    }
    
    const toLore = this.db.findLore(params.to_lore_id);
    if (!toLore) {
      throw new Error(`Target lore not found with ID: ${params.to_lore_id}`);
    }
    
    // Verify lores are in the same realm
    if (fromLore.realmId !== toLore.realmId) {
      throw new Error('Cannot create relation between lores in different realms');
    }
    
    // Create the relation
    const relation = this.db.createRelation({
      fromLoreId: params.from_lore_id,
      toLoreId: params.to_lore_id,
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
              fromLoreId: relation.fromLoreId,
              toLoreId: relation.toLoreId,
              type: relation.type,
              strength: relation.strength,
              metadata: relation.metadata,
              createdAt: relation.createdAt.toISOString(),
            },
            fromLore: {
              id: fromLore.id,
              content: fromLore.content,
            },
            toLore: {
              id: toLore.id,
              content: toLore.content,
            },
            message: 'Relation created successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async deleteRelation(args: unknown) {
    const params = DeleteRelationSchema.parse(args);
    
    // Verify the relation exists by checking if the lores exist
    const fromLore = this.db.findLore(params.from_lore_id);
    if (!fromLore) {
      throw new Error(`Source lore not found with ID: ${params.from_lore_id}`);
    }
    
    const toLore = this.db.findLore(params.to_lore_id);
    if (!toLore) {
      throw new Error(`Target lore not found with ID: ${params.to_lore_id}`);
    }
    
    // Delete the relation
    this.db.deleteRelation(params.from_lore_id, params.to_lore_id, params.type);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            deleted: true,
            fromLoreId: params.from_lore_id,
            toLoreId: params.to_lore_id,
            type: params.type,
            message: 'Relation deleted successfully',
          }, null, 2),
        },
      ],
    };
  }

  private async listRelations(args: unknown) {
    const params = ListRelationsSchema.parse(args);
    
    // Verify the lore exists
    const lore = this.db.findLore(params.lore_id);
    if (!lore) {
      throw new Error(`Lore not found with ID: ${params.lore_id}`);
    }
    
    // Get all relations for the lore
    const allRelations = this.db.listRelationsByLore(params.lore_id);
    
    // Filter by direction
    let relations = allRelations;
    if (params.direction === 'from') {
      relations = allRelations.filter(r => r.fromLoreId === params.lore_id);
    } else if (params.direction === 'to') {
      relations = allRelations.filter(r => r.toLoreId === params.lore_id);
    }
    
    // Get lore details for related lores
    const relatedLoreIds = new Set<string>();
    relations.forEach(r => {
      if (r.fromLoreId !== params.lore_id) relatedLoreIds.add(r.fromLoreId);
      if (r.toLoreId !== params.lore_id) relatedLoreIds.add(r.toLoreId);
    });
    
    const relatedLores = new Map<string, any>();
    for (const loreId of relatedLoreIds) {
      const relatedLore = this.db.findLore(loreId);
      if (relatedLore) {
        relatedLores.set(loreId, {
          id: relatedLore.id,
          content: relatedLore.content,
          type: relatedLore.type,
        });
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            lore: {
              id: lore.id,
              content: lore.content,
              type: lore.type,
            },
            relations: relations.map(r => ({
              fromLoreId: r.fromLoreId,
              toLoreId: r.toLoreId,
              type: r.type,
              strength: r.strength,
              metadata: r.metadata,
              createdAt: r.createdAt.toISOString(),
              direction: r.fromLoreId === params.lore_id ? 'outgoing' : 'incoming',
              relatedLore: relatedLores.get(r.fromLoreId === params.lore_id ? r.toLoreId : r.fromLoreId),
            })),
            total: relations.length,
            direction: params.direction,
          }, null, 2),
        },
      ],
    };
  }

  private async getRealmStats(args: unknown) {
    const params = GetRealmStatsSchema.parse(args);
    
    // Find the realm by path
    const realm = this.db.findRealmByPath(params.realm_path);
    if (!realm) {
      throw new Error(`Realm not found at path: ${params.realm_path}`);
    }
    
    // Get all lores for the realm
    const allLores = this.db.listLoresByRealm(realm.id);
    
    // Calculate statistics
    const stats = {
      totalLores: allLores.length,
      loresByType: {} as Record<LoreType, number>,
      loresByStatus: {} as Record<string, number>,
      loresByProvince: {} as Record<string, number>,
      averageConfidence: 0,
      highConfidenceLores: 0,
      lowConfidenceLores: 0,
      recentLores: [] as any[],
      loreGrowth: {
        lastWeek: 0,
        lastMonth: 0,
        lastQuarter: 0,
      },
      topSigils: [] as { sigil: string; count: number }[],
      relationStats: {
        totalRelations: 0,
        byType: {} as Record<string, number>,
      },
    };
    
    // Count lores by type
    for (const type of ['decree', 'wisdom', 'belief', 'constraint', 'requirement', 'risk', 'quest', 'saga', 'story', 'anomaly', 'other'] as LoreType[]) {
      stats.loresByType[type] = 0;
    }
    
    // Count lores by status
    for (const status of ['living', 'ancient', 'whispered', 'proclaimed', 'archived']) {
      stats.loresByStatus[status] = 0;
    }
    
    // Tag frequency map
    const sigilFrequency = new Map<string, number>();
    
    // Time boundaries for growth metrics
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    let totalConfidence = 0;
    
    // Process lores
    for (const lore of allLores) {
      // Type counts
      stats.loresByType[lore.type]++;
      
      // Status counts
      const status = lore.status || 'active';
      if (!(status in stats.loresByStatus)) {
        stats.loresByStatus[status] = 0;
      }
      stats.loresByStatus[status]!++;
      
      // Province counts
      for (const province of lore.provinces) {
        stats.loresByProvince[province] = (stats.loresByProvince[province] || 0) + 1;
      }
      
      // Confidence metrics
      totalConfidence += lore.confidence;
      if (lore.confidence >= 90) stats.highConfidenceLores++;
      if (lore.confidence < 50) stats.lowConfidenceLores++;
      
      // Sigil frequency
      for (const sigil of lore.sigils) {
        sigilFrequency.set(sigil, (sigilFrequency.get(sigil) || 0) + 1);
      }
      
      // Growth metrics
      if (lore.createdAt >= oneWeekAgo) stats.loreGrowth.lastWeek++;
      if (lore.createdAt >= oneMonthAgo) stats.loreGrowth.lastMonth++;
      if (lore.createdAt >= threeMonthsAgo) stats.loreGrowth.lastQuarter++;
    }
    
    // Calculate averages
    if (allLores.length > 0) {
      stats.averageConfidence = Math.round(totalConfidence / allLores.length);
    }
    
    // Get top 10 sigils
    const sortedSigils = Array.from(sigilFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sigil, count]) => ({ sigil, count }));
    stats.topSigils = sortedSigils;
    
    // Get 5 most recent lores
    stats.recentLores = allLores
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map(l => ({
        id: l.id,
        content: l.content,
        type: l.type,
        createdAt: l.createdAt.toISOString(),
      }));
    
    // Get relation statistics
    const allRelations = [];
    for (const lore of allLores) {
      const relations = this.db.listRelationsByLore(lore.id);
      allRelations.push(...relations);
    }
    
    // Deduplicate relations (since we're getting both directions)
    const uniqueRelations = new Map<string, any>();
    for (const rel of allRelations) {
      const key = `${rel.fromLoreId}-${rel.toLoreId}-${rel.type}`;
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
            realm: {
              id: realm.id,
              name: realm.name,
              path: realm.path,
              isMonorepo: realm.isMonorepo,
              provinces: realm.provinces,
              createdAt: realm.createdAt.toISOString(),
              lastSeen: realm.lastSeen.toISOString(),
            },
            statistics: stats,
          }, null, 2),
        },
      ],
    };
  }

  private async semanticSearchLores(args: unknown) {
    const params = SemanticSearchLoresSchema.parse(args);
    
    try {
      // Perform semantic search
      const results = await this.db.semanticSearchLores(params.query, {
        realmId: params.realm_path ? this.db.findRealmByPath(params.realm_path)?.id : undefined,
        threshold: params.threshold,
        limit: params.limit,
        includeScore: true
      });
      
      // Enrich results with realm information
      const enrichedResults = results.map(lore => {
        const realm = this.db.listRealms().find(r => r.id === lore.realmId);
        return {
          ...this.formatLore(lore),
          similarity: lore.similarity,
          realm: realm ? {
            name: realm.name,
            path: realm.path,
          } : undefined,
        };
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              lores: enrichedResults,
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
      return this.searchLores({
        query: params.query,
        realm_path: params.realm_path,
        limit: params.limit,
      });
    }
  }

  private async findSimilarLores(args: unknown) {
    const params = FindSimilarLoresSchema.parse(args);
    
    // Verify the lore exists
    const lore = this.db.findLore(params.lore_id);
    if (!lore) {
      throw new Error(`Lore not found with ID: ${params.lore_id}`);
    }
    
    try {
      // Find similar lores
      const similarLores = await this.db.findSimilarLores(params.lore_id, {
        limit: params.limit,
        threshold: params.threshold
      });
      
      // Enrich results with realm information
      const enrichedResults = similarLores.map(similarLore => {
        const realm = this.db.listRealms().find(r => r.id === similarLore.realmId);
        return {
          ...this.formatLore(similarLore),
          similarity: similarLore.similarity,
          realm: realm ? {
            name: realm.name,
            path: realm.path,
          } : undefined,
        };
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              originalLore: {
                ...this.formatLore(lore),
                realm: this.db.listRealms().find(r => r.id === lore.realmId)?.name,
              },
              similarLores: enrichedResults,
              total: enrichedResults.length,
              threshold: params.threshold,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Finding similar lores failed:', error);
      throw new Error(`Failed to find similar lores: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        name: 'search_lores',
        description: 'Search lores across all realms with optional filters',
      },
      {
        name: 'list_lores',
        description: 'List lores from all realms with optional filters',
      },
      {
        name: 'get_lore',
        description: 'Get a specific lore by ID',
      },
      {
        name: 'list_realms',
        description: 'List all realms in the LoreHub database',
      },
      {
        name: 'create_lore',
        description: 'Create a new lore in a realm',
      },
      {
        name: 'update_lore',
        description: 'Update an existing lore',
      },
      {
        name: 'delete_lore',
        description: 'Permanently delete a lore (requires confirmation)',
      },
      {
        name: 'archive_lore',
        description: 'Archive a lore (soft delete)',
      },
      {
        name: 'restore_lore',
        description: 'Restore an archived lore',
      },
      {
        name: 'create_relation',
        description: 'Create a relationship between two lores',
      },
      {
        name: 'delete_relation',
        description: 'Delete a relationship between two lores',
      },
      {
        name: 'list_relations',
        description: 'List all relationships for a lore',
      },
      {
        name: 'get_realm_stats',
        description: 'Get detailed statistics about a realm',
      },
      {
        name: 'semantic_search_lores',
        description: 'Search lores using semantic similarity to find conceptually related lores',
      },
      {
        name: 'find_similar_lores',
        description: 'Find lores similar to a given lore',
      },
    ];
  }

  async callTool(name: string, args: any) {
    // Direct implementation for testing
    switch (name) {
      case 'search_lores':
        const searchResult = await this.searchLores(args);
        return JSON.parse(searchResult.content[0]!.text!);
      case 'list_lores':
        const listResult = await this.listLores(args);
        return JSON.parse(listResult.content[0]!.text!);
      case 'get_lore':
        const getResult = await this.getLore(args);
        return JSON.parse(getResult.content[0]!.text!);
      case 'list_realms':
        const realmsResult = await this.listRealms(args);
        return JSON.parse(realmsResult.content[0]!.text!);
      case 'create_lore':
        const createResult = await this.createLore(args);
        return JSON.parse(createResult.content[0]!.text!);
      case 'update_lore':
        const updateResult = await this.updateLore(args);
        return JSON.parse(updateResult.content[0]!.text!);
      case 'delete_lore':
        const deleteResult = await this.deleteLore(args);
        return JSON.parse(deleteResult.content[0]!.text!);
      case 'archive_lore':
        const archiveResult = await this.archiveLore(args);
        return JSON.parse(archiveResult.content[0]!.text!);
      case 'restore_lore':
        const restoreResult = await this.restoreLore(args);
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
      case 'get_realm_stats':
        const statsResult = await this.getRealmStats(args);
        return JSON.parse(statsResult.content[0]!.text!);
      case 'semantic_search_lores':
        const semanticResult = await this.semanticSearchLores(args);
        return JSON.parse(semanticResult.content[0]!.text!);
      case 'find_similar_lores':
        const similarResult = await this.findSimilarLores(args);
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