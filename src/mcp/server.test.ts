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