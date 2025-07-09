import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoreHubServer } from './server.js';
import { Database } from '../db/database.js';
import type { Fact, Project } from '../core/types.js';

// We'll create a mock database instance instead of mocking the constructor

describe('LoreHubServer', () => {
  let server: LoreHubServer;
  let mockDb: any;

  const mockProject: Project = {
    id: 'proj-123',
    name: 'test-project',
    path: '/test/project',
    isMonorepo: false,
    services: [],
    lastSeen: new Date(),
    createdAt: new Date(),
  };

  const mockFacts: Fact[] = [
    {
      id: 'fact-1',
      projectId: 'proj-123',
      content: 'Use PostgreSQL for data storage',
      why: 'Need ACID compliance',
      type: 'decision',
      services: [],
      tags: ['database', 'postgresql'],
      confidence: 90,
      source: { type: 'manual', reference: 'cli' },
      status: 'active',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'fact-2',
      projectId: 'proj-123',
      content: 'Redis for caching',
      type: 'decision',
      services: [],
      tags: ['cache', 'redis'],
      confidence: 85,
      source: { type: 'manual', reference: 'cli' },
      status: 'active',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    
    // Create a mock database object
    mockDb = {
      findProjectByPath: vi.fn(),
      searchFacts: vi.fn(),
      listFactsByProject: vi.fn(),
      listFactsByType: vi.fn(),
      listFactsByService: vi.fn(),
      getFactById: vi.fn(),
      listProjects: vi.fn(),
      createFact: vi.fn(),
      updateFact: vi.fn(),
      deleteFact: vi.fn(),
      softDeleteFact: vi.fn(),
      restoreFact: vi.fn(),
      createProject: vi.fn(),
      createRelation: vi.fn(),
      deleteRelation: vi.fn(),
      listRelationsByFact: vi.fn(),
      close: vi.fn(),
    } as any;
    
    // Pass the mock database directly to the server
    server = new LoreHubServer(mockDb);
  });

  describe('Server Info', () => {
    it('should return correct server info', async () => {
      const info = await server.getServerInfo();
      
      expect(info.name).toBe('lorehub');
      expect(info.version).toBeDefined();
      expect(info.capabilities).toEqual({
        tools: {},
      });
    });
  });

  describe('Tools', () => {
    it('should list available tools', async () => {
      const tools = await server.listTools();
      
      expect(tools).toContainEqual(
        expect.objectContaining({
          name: 'search_facts',
          description: expect.stringContaining('Search facts'),
        })
      );
      
      expect(tools).toContainEqual(
        expect.objectContaining({
          name: 'list_facts',
          description: expect.stringContaining('List facts'),
        })
      );

      expect(tools).toContainEqual(
        expect.objectContaining({
          name: 'get_fact',
          description: expect.stringContaining('Get a specific fact'),
        })
      );

      expect(tools).toContainEqual(
        expect.objectContaining({
          name: 'list_projects',
          description: expect.stringContaining('List all projects'),
        })
      );
    });

    describe('search_facts', () => {
      beforeEach(() => {
        vi.clearAllMocks();
        mockDb.findProjectByPath = vi.fn().mockReturnValue(mockProject);
        mockDb.listProjects = vi.fn().mockReturnValue([mockProject]);
        mockDb.searchFacts = vi.fn().mockReturnValue(mockFacts);
      });

      it('should search facts with query', async () => {
        const result = await server.callTool('search_facts', {
          query: 'database',
          project_path: '/test/project',
        });

        expect(mockDb.searchFacts).toHaveBeenCalledWith('proj-123', 'database');
        expect(result).toHaveProperty('facts');
        expect(result.facts).toHaveLength(2);
        // Facts are sorted by date, fact-2 has a later date
        expect(result.facts[0]).toMatchObject({
          id: 'fact-2',
          content: 'Redis for caching',
          type: 'decision',
          project: {
            name: 'test-project',
            path: '/test/project',
          },
        });
        expect(result.facts[1]).toMatchObject({
          id: 'fact-1',
          content: 'Use PostgreSQL for data storage',
          type: 'decision',
          project: {
            name: 'test-project',
            path: '/test/project',
          },
        });
      });

      it('should filter by type', async () => {
        // searchFacts applies the filter after searching, not using listFactsByType
        const result = await server.callTool('search_facts', {
          query: 'database',
          project_path: '/test/project',
          type: 'decision',
        });

        // Both facts match "database" but we're filtering by type
        expect(result.facts).toHaveLength(2);
        expect(result.facts.every((f: any) => f.type === 'decision')).toBe(true);
      });

      it('should handle project not found', async () => {
        mockDb.findProjectByPath = vi.fn().mockReturnValue(null);

        await expect(
          server.callTool('search_facts', {
            query: 'test',
            project_path: '/nonexistent',
          })
        ).rejects.toThrow('Project not found');
      });

      it('should search across all projects when no project_path specified', async () => {
        const project2 = { ...mockProject, id: 'proj-456', name: 'another-project' };
        mockDb.listProjects = vi.fn().mockReturnValue([mockProject, project2]);
        mockDb.searchFacts = vi.fn()
          .mockReturnValueOnce([mockFacts[0]])  // First project
          .mockReturnValueOnce([mockFacts[1]]); // Second project

        const result = await server.callTool('search_facts', {
          query: 'test',
        });

        expect(mockDb.listProjects).toHaveBeenCalled();
        expect(mockDb.searchFacts).toHaveBeenCalledTimes(2);
        expect(result.searchedProjects).toBe(2);
        expect(result.facts).toHaveLength(2);
      });
    });

    describe('list_facts', () => {
      beforeEach(() => {
        vi.clearAllMocks();
        mockDb.findProjectByPath = vi.fn().mockReturnValue(mockProject);
        mockDb.listProjects = vi.fn().mockReturnValue([mockProject]);
        mockDb.listFactsByProject = vi.fn().mockReturnValue(mockFacts);
      });

      it('should list all facts for a project', async () => {
        const result = await server.callTool('list_facts', {
          project_path: '/test/project',
        });

        expect(mockDb.listFactsByProject).toHaveBeenCalledWith('proj-123');
        expect(result.facts).toHaveLength(2);
        expect(result.total).toBe(2);
      });

      it('should respect limit parameter', async () => {
        const result = await server.callTool('list_facts', {
          project_path: '/test/project',
          limit: 1,
        });

        expect(result.facts).toHaveLength(1);
      });

      it('should filter by type', async () => {
        mockDb.listFactsByType = vi.fn().mockReturnValue([mockFacts[0]]);

        const result = await server.callTool('list_facts', {
          project_path: '/test/project',
          type: 'decision',
        });

        expect(mockDb.listFactsByType).toHaveBeenCalledWith('proj-123', 'decision');
        expect(result.facts).toHaveLength(1);
      });

      it('should filter by service', async () => {
        mockDb.listFactsByService = vi.fn().mockReturnValue([]);

        const result = await server.callTool('list_facts', {
          project_path: '/test/project',
          service: 'api',
        });

        expect(mockDb.listFactsByService).toHaveBeenCalledWith('proj-123', 'api');
        expect(result.facts).toHaveLength(0);
      });
    });

    describe('get_fact', () => {
      beforeEach(() => {
        // Reset mocks before each test in this describe block
        vi.clearAllMocks();
      });

      it('should return a specific fact by ID', async () => {
        // Create a fresh fact object to avoid any pollution
        const factToReturn = {
          id: 'fact-1',
          projectId: 'proj-123',
          content: 'Use PostgreSQL for data storage',
          why: 'Need ACID compliance',
          type: 'decision',
          services: [],
          tags: ['database', 'postgresql'],
          confidence: 90,
          source: { type: 'manual', reference: 'cli' },
          status: 'active',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        };
        
        mockDb.getFactById.mockReturnValue(factToReturn);
        mockDb.listProjects.mockReturnValue([mockProject]);

        const result = await server.callTool('get_fact', {
          fact_id: 'fact-1',
        });

        expect(mockDb.getFactById).toHaveBeenCalledWith('fact-1');
        expect(result.fact.id).toBe('fact-1');
        expect(result.fact.content).toBe('Use PostgreSQL for data storage');
      });

      it('should handle fact not found', async () => {
        mockDb.getFactById.mockReturnValue(null);

        await expect(
          server.callTool('get_fact', {
            fact_id: 'nonexistent',
          })
        ).rejects.toThrow('Fact not found');
      });
    });

    describe('list_projects', () => {
      beforeEach(() => {
        vi.clearAllMocks();
      });

      it('should list all projects', async () => {
        mockDb.listProjects = vi.fn().mockReturnValue([mockProject]);
        mockDb.listFactsByProject = vi.fn().mockReturnValue(mockFacts);

        const result = await server.callTool('list_projects', {});

        expect(mockDb.listProjects).toHaveBeenCalled();
        expect(result.projects).toHaveLength(1);
        expect(result.projects[0]).toMatchObject({
          id: 'proj-123',
          name: 'test-project',
          path: '/test/project',
        });
      });
    });

    describe('create_fact', () => {
      it('should create a new fact', async () => {
        const newFact: Fact = {
          id: 'fact-new',
          projectId: 'proj-123',
          content: 'New architectural decision',
          why: 'To improve performance',
          type: 'decision',
          services: ['api', 'frontend'],
          tags: ['architecture', 'performance'],
          confidence: 95,
          source: { type: 'manual', reference: 'mcp' },
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Make project's lastSeen different from createdAt to indicate it's not newly created
        const existingProject = {
          ...mockProject,
          lastSeen: new Date(Date.now() + 1000), // 1 second later
        };

        mockDb.findProjectByPath = vi.fn().mockReturnValue(existingProject);
        mockDb.createFact = vi.fn().mockReturnValue(newFact);

        const result = await server.callTool('create_fact', {
          project_path: '/test/project',
          content: 'New architectural decision',
          why: 'To improve performance',
          type: 'decision',
          services: ['api', 'frontend'],
          tags: ['architecture', 'performance'],
          confidence: 95,
        });

        expect(mockDb.findProjectByPath).toHaveBeenCalledWith('/test/project');
        expect(mockDb.createFact).toHaveBeenCalledWith({
          projectId: 'proj-123',
          content: 'New architectural decision',
          why: 'To improve performance',
          type: 'decision',
          services: ['api', 'frontend'],
          tags: ['architecture', 'performance'],
          confidence: 95,
          source: { type: 'manual', reference: 'mcp' },
        });
        expect(result.fact).toMatchObject({
          id: 'fact-new',
          content: 'New architectural decision',
          type: 'decision',
        });
        expect(result.message).toBe('Fact created successfully');
      });

      it('should auto-create project if not found', async () => {
        const newProject: Project = {
          id: 'proj-new',
          name: 'newproject',
          path: '/nonexistent/newproject',
          isMonorepo: false,
          services: [],
          lastSeen: new Date(),
          createdAt: new Date(),
        };

        const newFact: Fact = {
          id: 'fact-new',
          projectId: 'proj-new',
          content: 'Test fact',
          type: 'decision',
          services: [],
          tags: [],
          confidence: 80,
          source: { type: 'manual', reference: 'mcp' },
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDb.findProjectByPath = vi.fn().mockReturnValue(null);
        mockDb.createProject = vi.fn().mockReturnValue(newProject);
        mockDb.createFact = vi.fn().mockReturnValue(newFact);

        const result = await server.callTool('create_fact', {
          project_path: '/nonexistent/newproject',
          content: 'Test fact',
          type: 'decision',
        });

        expect(mockDb.createProject).toHaveBeenCalledWith({
          name: 'newproject',
          path: '/nonexistent/newproject',
          isMonorepo: false,
          services: [],
        });
        expect(mockDb.createFact).toHaveBeenCalled();
        expect(result.message).toBe('Project initialized and fact created successfully');
        expect(result.project.created).toBe(true);
      });
    });

    describe('update_fact', () => {
      it('should update an existing fact', async () => {
        const existingFact = mockFacts[0]!;
        const updatedFact: Fact = {
          id: existingFact.id,
          projectId: existingFact.projectId,
          content: 'Use PostgreSQL 15 for data storage',
          why: existingFact.why,
          type: existingFact.type,
          services: existingFact.services,
          tags: ['database', 'postgresql', 'upgrade'],
          confidence: 95,
          source: existingFact.source,
          status: existingFact.status,
          createdAt: existingFact.createdAt,
          updatedAt: new Date(),
        };

        mockDb.getFactById = vi.fn().mockReturnValue(existingFact);
        mockDb.updateFact = vi.fn().mockReturnValue(updatedFact);
        mockDb.listProjects = vi.fn().mockReturnValue([mockProject]);

        const result = await server.callTool('update_fact', {
          fact_id: 'fact-1',
          content: 'Use PostgreSQL 15 for data storage',
          confidence: 95,
          tags: ['database', 'postgresql', 'upgrade'],
        });

        expect(mockDb.getFactById).toHaveBeenCalledWith('fact-1');
        expect(mockDb.updateFact).toHaveBeenCalledWith('fact-1', {
          content: 'Use PostgreSQL 15 for data storage',
          confidence: 95,
          tags: ['database', 'postgresql', 'upgrade'],
          why: undefined,
          type: undefined,
          services: undefined,
          status: undefined,
          source: undefined,
        });
        expect(result.fact.content).toBe('Use PostgreSQL 15 for data storage');
        expect(result.fact.confidence).toBe(95);
        expect(result.message).toBe('Fact updated successfully');
      });

      it('should throw error if fact not found', async () => {
        mockDb.getFactById = vi.fn().mockReturnValue(null);

        await expect(
          server.callTool('update_fact', {
            fact_id: 'nonexistent-fact',
            content: 'Updated content',
          })
        ).rejects.toThrow('Fact not found with ID: nonexistent-fact');
      });

      it('should update fact status', async () => {
        const existingFact = mockFacts[0]!;
        const archivedFact: Fact = {
          id: existingFact.id,
          projectId: existingFact.projectId,
          content: existingFact.content,
          why: existingFact.why,
          type: existingFact.type,
          services: existingFact.services,
          tags: existingFact.tags,
          confidence: existingFact.confidence,
          source: existingFact.source,
          status: 'archived',
          createdAt: existingFact.createdAt,
          updatedAt: new Date(),
        };

        mockDb.getFactById = vi.fn().mockReturnValue(existingFact);
        mockDb.updateFact = vi.fn().mockReturnValue(archivedFact);
        mockDb.listProjects = vi.fn().mockReturnValue([mockProject]);

        const result = await server.callTool('update_fact', {
          fact_id: 'fact-1',
          status: 'archived',
        });

        expect(result.fact.status).toBe('archived');
      });
    });

    describe('delete_fact', () => {
      it('should delete a fact with confirmation', async () => {
        const factToDelete = mockFacts[0]!;
        
        mockDb.getFactById = vi.fn().mockReturnValue(factToDelete);
        mockDb.listProjects = vi.fn().mockReturnValue([mockProject]);
        mockDb.deleteFact = vi.fn();

        const result = await server.callTool('delete_fact', {
          fact_id: 'fact-1',
          confirm: true,
        });

        expect(mockDb.getFactById).toHaveBeenCalledWith('fact-1');
        expect(mockDb.deleteFact).toHaveBeenCalledWith('fact-1');
        expect(result.deleted).toBe(true);
        expect(result.fact_id).toBe('fact-1');
        expect(result.message).toBe('Fact permanently deleted');
      });

      it('should throw error without confirmation', async () => {
        await expect(
          server.callTool('delete_fact', {
            fact_id: 'fact-1',
            confirm: false,
          })
        ).rejects.toThrow('Deletion must be confirmed by setting confirm: true');
      });

      it('should throw error if fact not found', async () => {
        mockDb.getFactById = vi.fn().mockReturnValue(null);

        await expect(
          server.callTool('delete_fact', {
            fact_id: 'nonexistent-fact',
            confirm: true,
          })
        ).rejects.toThrow('Fact not found with ID: nonexistent-fact');
      });
    });

    describe('archive_fact', () => {
      it('should archive an active fact', async () => {
        const activeFact = mockFacts[0]!;
        const archivedFact: Fact = {
          id: activeFact.id,
          projectId: activeFact.projectId,
          content: activeFact.content,
          why: activeFact.why,
          type: activeFact.type,
          services: activeFact.services,
          tags: activeFact.tags,
          confidence: activeFact.confidence,
          source: activeFact.source,
          status: 'archived',
          createdAt: activeFact.createdAt,
          updatedAt: new Date(),
        };

        mockDb.getFactById = vi.fn()
          .mockReturnValueOnce(activeFact) // First call: verify exists
          .mockReturnValueOnce(archivedFact); // Second call: after archiving
        mockDb.softDeleteFact = vi.fn();
        mockDb.listProjects = vi.fn().mockReturnValue([mockProject]);

        const result = await server.callTool('archive_fact', {
          fact_id: 'fact-1',
        });

        expect(mockDb.softDeleteFact).toHaveBeenCalledWith('fact-1');
        expect(result.fact.status).toBe('archived');
        expect(result.message).toBe('Fact archived successfully');
      });

      it('should throw error if fact already archived', async () => {
        const archivedFact = { ...mockFacts[0]!, status: 'archived' };
        mockDb.getFactById = vi.fn().mockReturnValue(archivedFact);

        await expect(
          server.callTool('archive_fact', {
            fact_id: 'fact-1',
          })
        ).rejects.toThrow('Fact is already archived');
      });

      it('should throw error if fact not found', async () => {
        mockDb.getFactById = vi.fn().mockReturnValue(null);

        await expect(
          server.callTool('archive_fact', {
            fact_id: 'nonexistent-fact',
          })
        ).rejects.toThrow('Fact not found with ID: nonexistent-fact');
      });
    });

    describe('restore_fact', () => {
      it('should restore an archived fact', async () => {
        const archivedFact = { ...mockFacts[0]!, status: 'archived' as const };
        const restoredFact: Fact = {
          id: archivedFact.id,
          projectId: archivedFact.projectId,
          content: archivedFact.content,
          why: archivedFact.why,
          type: archivedFact.type,
          services: archivedFact.services,
          tags: archivedFact.tags,
          confidence: archivedFact.confidence,
          source: archivedFact.source,
          status: 'active',
          createdAt: archivedFact.createdAt,
          updatedAt: new Date(),
        };

        mockDb.getFactById = vi.fn()
          .mockReturnValueOnce(archivedFact) // First call: verify exists and archived
          .mockReturnValueOnce(restoredFact); // Second call: after restoring
        mockDb.restoreFact = vi.fn();
        mockDb.listProjects = vi.fn().mockReturnValue([mockProject]);

        const result = await server.callTool('restore_fact', {
          fact_id: 'fact-1',
        });

        expect(mockDb.restoreFact).toHaveBeenCalledWith('fact-1');
        expect(result.fact.status).toBe('active');
        expect(result.message).toBe('Fact restored successfully');
      });

      it('should throw error if fact not archived', async () => {
        const activeFact = mockFacts[0]!;
        mockDb.getFactById = vi.fn().mockReturnValue(activeFact);

        await expect(
          server.callTool('restore_fact', {
            fact_id: 'fact-1',
          })
        ).rejects.toThrow('Fact is not archived');
      });

      it('should throw error if fact not found', async () => {
        mockDb.getFactById = vi.fn().mockReturnValue(null);

        await expect(
          server.callTool('restore_fact', {
            fact_id: 'nonexistent-fact',
          })
        ).rejects.toThrow('Fact not found with ID: nonexistent-fact');
      });
    });

    describe('relation tools', () => {
      const mockRelation = {
        fromFactId: 'fact-1',
        toFactId: 'fact-2',
        type: 'depends_on',
        strength: 1.0,
        metadata: null,
        createdAt: new Date(),
      };

      describe('create_relation', () => {
        it('should create a relation between two facts', async () => {
          mockDb.getFactById = vi.fn()
            .mockReturnValueOnce(mockFacts[0]) // fromFact
            .mockReturnValueOnce(mockFacts[1]); // toFact
          mockDb.createRelation = vi.fn().mockReturnValue(mockRelation);

          const result = await server.callTool('create_relation', {
            from_fact_id: 'fact-1',
            to_fact_id: 'fact-2',
            type: 'depends_on',
            strength: 1.0,
          });

          expect(mockDb.createRelation).toHaveBeenCalledWith({
            fromFactId: 'fact-1',
            toFactId: 'fact-2',
            type: 'depends_on',
            strength: 1.0,
            metadata: undefined,
          });
          expect(result.relation.type).toBe('depends_on');
          expect(result.message).toBe('Relation created successfully');
        });

        it('should throw error if source fact not found', async () => {
          mockDb.getFactById = vi.fn().mockReturnValue(null);

          await expect(
            server.callTool('create_relation', {
              from_fact_id: 'nonexistent',
              to_fact_id: 'fact-2',
              type: 'depends_on',
            })
          ).rejects.toThrow('Source fact not found with ID: nonexistent');
        });

        it('should throw error if facts are in different projects', async () => {
          const fact1 = { ...mockFacts[0], projectId: 'proj-1' };
          const fact2 = { ...mockFacts[1], projectId: 'proj-2' };
          
          mockDb.getFactById = vi.fn()
            .mockReturnValueOnce(fact1)
            .mockReturnValueOnce(fact2);

          await expect(
            server.callTool('create_relation', {
              from_fact_id: 'fact-1',
              to_fact_id: 'fact-2',
              type: 'depends_on',
            })
          ).rejects.toThrow('Cannot create relation between facts in different projects');
        });
      });

      describe('delete_relation', () => {
        it('should delete a relation', async () => {
          mockDb.getFactById = vi.fn()
            .mockReturnValueOnce(mockFacts[0]) // fromFact
            .mockReturnValueOnce(mockFacts[1]); // toFact
          mockDb.deleteRelation = vi.fn();

          const result = await server.callTool('delete_relation', {
            from_fact_id: 'fact-1',
            to_fact_id: 'fact-2',
            type: 'depends_on',
          });

          expect(mockDb.deleteRelation).toHaveBeenCalledWith('fact-1', 'fact-2', 'depends_on');
          expect(result.deleted).toBe(true);
          expect(result.message).toBe('Relation deleted successfully');
        });
      });

      describe('list_relations', () => {
        it('should list all relations for a fact', async () => {
          const relations = [
            mockRelation,
            {
              fromFactId: 'fact-2',
              toFactId: 'fact-1',
              type: 'contradicts',
              strength: 0.8,
              metadata: null,
              createdAt: new Date(),
            },
          ];

          mockDb.getFactById = vi.fn()
            .mockReturnValueOnce(mockFacts[0]) // main fact
            .mockReturnValueOnce(mockFacts[1]); // related fact
          mockDb.listRelationsByFact = vi.fn().mockReturnValue(relations);

          const result = await server.callTool('list_relations', {
            fact_id: 'fact-1',
            direction: 'both',
          });

          expect(mockDb.listRelationsByFact).toHaveBeenCalledWith('fact-1');
          expect(result.relations).toHaveLength(2);
          expect(result.relations[0].direction).toBe('outgoing');
          expect(result.relations[1].direction).toBe('incoming');
        });

        it('should filter by direction', async () => {
          const relations = [
            mockRelation,
            {
              fromFactId: 'fact-2',
              toFactId: 'fact-1',
              type: 'contradicts',
              strength: 0.8,
              metadata: null,
              createdAt: new Date(),
            },
          ];

          mockDb.getFactById = vi.fn().mockReturnValue(mockFacts[0]);
          mockDb.listRelationsByFact = vi.fn().mockReturnValue(relations);

          const result = await server.callTool('list_relations', {
            fact_id: 'fact-1',
            direction: 'from',
          });

          expect(result.relations).toHaveLength(1);
          expect(result.relations[0].fromFactId).toBe('fact-1');
        });
      });
    });

    describe('get_project_stats', () => {
      it('should return comprehensive project statistics', async () => {
        const facts = [
          ...mockFacts,
          {
            id: 'fact-3',
            projectId: 'proj-123',
            content: 'High confidence decision',
            type: 'decision' as const,
            services: ['api'],
            tags: ['important', 'architecture'],
            confidence: 95,
            source: { type: 'manual' as const, reference: 'cli' },
            status: 'active' as const,
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
            updatedAt: new Date(),
          },
          {
            id: 'fact-4',
            projectId: 'proj-123',
            content: 'Low confidence assumption',
            type: 'assumption' as const,
            services: ['frontend'],
            tags: ['uncertain', 'review'],
            confidence: 30,
            source: { type: 'manual' as const, reference: 'cli' },
            status: 'archived' as const,
            createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
            updatedAt: new Date(),
          },
        ];

        mockDb.findProjectByPath = vi.fn().mockReturnValue(mockProject);
        mockDb.listFactsByProject = vi.fn().mockReturnValue(facts);
        mockDb.listRelationsByFact = vi.fn().mockReturnValue([]);

        const result = await server.callTool('get_project_stats', {
          project_path: '/test/project',
        });

        expect(mockDb.findProjectByPath).toHaveBeenCalledWith('/test/project');
        expect(mockDb.listFactsByProject).toHaveBeenCalledWith('proj-123');
        
        expect(result.statistics.totalFacts).toBe(4);
        expect(result.statistics.factsByType.decision).toBe(3);
        expect(result.statistics.factsByType.assumption).toBe(1);
        expect(result.statistics.factsByStatus.active).toBe(3);
        expect(result.statistics.factsByStatus.archived).toBe(1);
        expect(result.statistics.highConfidenceFacts).toBe(2);
        expect(result.statistics.lowConfidenceFacts).toBe(1);
        expect(result.statistics.averageConfidence).toBeGreaterThan(0);
        expect(result.statistics.factGrowth.lastWeek).toBe(1);
        expect(result.statistics.topTags.length).toBeGreaterThanOrEqual(6);
      });

      it('should throw error if project not found', async () => {
        mockDb.findProjectByPath = vi.fn().mockReturnValue(null);

        await expect(
          server.callTool('get_project_stats', {
            project_path: '/nonexistent/project',
          })
        ).rejects.toThrow('Project not found at path: /nonexistent/project');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool', async () => {
      await expect(
        server.callTool('unknown_tool', {})
      ).rejects.toThrow('Tool not found: unknown_tool');
    });

    it('should handle database errors gracefully', async () => {
      mockDb.findProjectByPath = vi.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(
        server.callTool('search_facts', {
          query: 'test',
          project_path: '/test',
        })
      ).rejects.toThrow('Database connection failed');
    });
  });
});