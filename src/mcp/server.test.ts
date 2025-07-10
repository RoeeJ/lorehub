import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoreHubServer } from './server.js';
import { Database } from '../db/database.js';
import type { Lore, Realm } from '../core/types.js';

// We'll create a mock database instance instead of mocking the constructor

describe('LoreHubServer', () => {
  let server: LoreHubServer;
  let mockDb: any;

  const mockRealm: Realm = {
    id: 'realm-123',
    name: 'test-realm',
    path: '/test/realm',
    isMonorepo: false,
    provinces: [],
    lastSeen: new Date(),
    createdAt: new Date(),
  };

  const mockLores: Lore[] = [
    {
      id: 'lore-1',
      realmId: 'realm-123',
      content: 'Use PostgreSQL for data storage',
      why: 'Need ACID compliance',
      type: 'decree',
      provinces: [],
      sigils: ['database', 'postgresql'],
      confidence: 90,
      origin: { type: 'manual', reference: 'cli' },
      status: 'living',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'lore-2',
      realmId: 'realm-123',
      content: 'Redis for caching',
      type: 'decree',
      provinces: [],
      sigils: ['cache', 'redis'],
      confidence: 85,
      origin: { type: 'manual', reference: 'cli' },
      status: 'living',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    
    // Create a mock database object
    mockDb = {
      findRealmByPath: vi.fn(),
      searchLores: vi.fn(),
      listLoresByRealm: vi.fn(),
      listLoresByType: vi.fn(),
      listLoresByService: vi.fn(),
      findLore: vi.fn(),
      listRealms: vi.fn(),
      createLore: vi.fn(),
      updateLore: vi.fn(),
      deleteLore: vi.fn(),
      softDeleteLore: vi.fn(),
      restoreLore: vi.fn(),
      createRealm: vi.fn(),
      createRelation: vi.fn(),
      deleteRelation: vi.fn(),
      listRelationsByLore: vi.fn(),
      getRealmLoreCount: vi.fn(),
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
          name: 'search_lores',
          description: expect.stringContaining('Search lores'),
        })
      );
      
      expect(tools).toContainEqual(
        expect.objectContaining({
          name: 'list_lores',
          description: expect.stringContaining('List lores'),
        })
      );

      expect(tools).toContainEqual(
        expect.objectContaining({
          name: 'get_lore',
          description: expect.stringContaining('Get a specific lore'),
        })
      );

      expect(tools).toContainEqual(
        expect.objectContaining({
          name: 'list_realms',
          description: expect.stringContaining('List all realms'),
        })
      );
    });

    describe('search_lores', () => {
      beforeEach(() => {
        vi.clearAllMocks();
        mockDb.findRealmByPath = vi.fn().mockReturnValue(mockRealm);
        mockDb.listRealms = vi.fn().mockReturnValue([mockRealm]);
        mockDb.searchLores = vi.fn().mockReturnValue(mockLores);
      });

      it('should search lores with query', async () => {
        const result = await server.callTool('search_lores', {
          query: 'database',
          realm_path: '/test/realm',
        });

        expect(mockDb.searchLores).toHaveBeenCalledWith('realm-123', 'database');
        expect(result).toHaveProperty('lores');
        expect(result.lores).toHaveLength(2);
        // Lores are sorted by date, lore-2 has a later date
        expect(result.lores[0]).toMatchObject({
          id: 'lore-2',
          content: 'Redis for caching',
          type: 'decree',
          realm: {
            name: 'test-realm',
            path: '/test/realm',
          },
        });
        expect(result.lores[1]).toMatchObject({
          id: 'lore-1',
          content: 'Use PostgreSQL for data storage',
          type: 'decree',
          realm: {
            name: 'test-realm',
            path: '/test/realm',
          },
        });
      });

      it('should filter by type', async () => {
        // searchLores applies the filter after searching, not using listLoresByType
        const result = await server.callTool('search_lores', {
          query: 'database',
          realm_path: '/test/realm',
          type: 'decree',
        });

        // Both lores match "database" but we're filtering by type
        expect(result.lores).toHaveLength(2);
        expect(result.lores.every((l: any) => l.type === 'decree')).toBe(true);
      });

      it('should handle realm not found', async () => {
        mockDb.findRealmByPath = vi.fn().mockReturnValue(null);

        await expect(
          server.callTool('search_lores', {
            query: 'test',
            realm_path: '/nonexistent',
          })
        ).rejects.toThrow('Realm not found');
      });

      it('should search across all realms when no realm_path specified', async () => {
        const realm2 = { ...mockRealm, id: 'realm-456', name: 'another-realm' };
        mockDb.listRealms = vi.fn().mockReturnValue([mockRealm, realm2]);
        mockDb.searchLores = vi.fn()
          .mockReturnValueOnce([mockLores[0]])  // First realm
          .mockReturnValueOnce([mockLores[1]]); // Second realm

        const result = await server.callTool('search_lores', {
          query: 'test',
        });

        expect(mockDb.listRealms).toHaveBeenCalled();
        expect(mockDb.searchLores).toHaveBeenCalledTimes(2);
        expect(result.searchedRealms).toBe(2);
        expect(result.lores).toHaveLength(2);
      });
    });

    describe('list_lores', () => {
      beforeEach(() => {
        vi.clearAllMocks();
        mockDb.findRealmByPath = vi.fn().mockReturnValue(mockRealm);
        mockDb.listRealms = vi.fn().mockReturnValue([mockRealm]);
        mockDb.listLoresByRealm = vi.fn().mockReturnValue(mockLores);
      });

      it('should list all lores for a realm', async () => {
        const result = await server.callTool('list_lores', {
          realm_path: '/test/realm',
        });

        expect(mockDb.listLoresByRealm).toHaveBeenCalledWith('realm-123');
        expect(result.lores).toHaveLength(2);
        expect(result.total).toBe(2);
      });

      it('should respect limit parameter', async () => {
        const result = await server.callTool('list_lores', {
          realm_path: '/test/realm',
          limit: 1,
        });

        expect(result.lores).toHaveLength(1);
      });

      it('should filter by type', async () => {
        mockDb.listLoresByType = vi.fn().mockReturnValue([mockLores[0]]);

        const result = await server.callTool('list_lores', {
          realm_path: '/test/realm',
          type: 'decree',
        });

        expect(mockDb.listLoresByType).toHaveBeenCalledWith('realm-123', 'decree');
        expect(result.lores).toHaveLength(1);
      });

      it('should filter by province', async () => {
        mockDb.listLoresByProvince = vi.fn().mockReturnValue([]);

        const result = await server.callTool('list_lores', {
          realm_path: '/test/realm',
          province: 'api',
        });

        expect(mockDb.listLoresByProvince).toHaveBeenCalledWith('realm-123', 'api');
        expect(result.lores).toHaveLength(0);
      });
    });

    describe('get_lore', () => {
      beforeEach(() => {
        // Reset mocks before each test in this describe block
        vi.clearAllMocks();
      });

      it('should return a specific lore by ID', async () => {
        // Create a fresh lore object to avoid any pollution
        const loreToReturn = {
          id: 'lore-1',
          realmId: 'realm-123',
          content: 'Use PostgreSQL for data storage',
          why: 'Need ACID compliance',
          type: 'decree',
          provinces: [],
          sigils: ['database', 'postgresql'],
          confidence: 90,
          origin: { type: 'manual', reference: 'cli' },
          status: 'living',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        };
        
        mockDb.findLore.mockReturnValue(loreToReturn);
        mockDb.listRealms.mockReturnValue([mockRealm]);

        const result = await server.callTool('get_lore', {
          lore_id: 'lore-1',
        });

        expect(mockDb.findLore).toHaveBeenCalledWith('lore-1');
        expect(result.lore.id).toBe('lore-1');
        expect(result.lore.content).toBe('Use PostgreSQL for data storage');
      });

      it('should handle lore not found', async () => {
        mockDb.findLore.mockReturnValue(null);

        await expect(
          server.callTool('get_lore', {
            lore_id: 'nonexistent',
          })
        ).rejects.toThrow('Lore not found');
      });
    });

    describe('list_realms', () => {
      beforeEach(() => {
        vi.clearAllMocks();
      });

      it('should list all realms', async () => {
        mockDb.listRealms = vi.fn().mockReturnValue([mockRealm]);
        mockDb.listLoresByRealm = vi.fn().mockReturnValue(mockLores);
        mockDb.getRealmLoreCount = vi.fn().mockReturnValue(2);

        const result = await server.callTool('list_realms', {});

        expect(mockDb.listRealms).toHaveBeenCalled();
        expect(result.realms).toHaveLength(1);
        expect(result.realms[0]).toMatchObject({
          id: 'realm-123',
          name: 'test-realm',
          path: '/test/realm',
        });
      });
    });

    describe('create_lore', () => {
      it('should create a new lore', async () => {
        const newLore: Lore = {
          id: 'lore-new',
          realmId: 'realm-123',
          content: 'New architectural decision',
          why: 'To improve performance',
          type: 'decree',
          provinces: ['api', 'frontend'],
          sigils: ['architecture', 'performance'],
          confidence: 95,
          origin: { type: 'manual', reference: 'mcp' },
          status: 'living',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Make realm's lastSeen different from createdAt to indicate it's not newly created
        const existingRealm = {
          ...mockRealm,
          lastSeen: new Date(Date.now() + 1000), // 1 second later
        };

        mockDb.findRealmByPath = vi.fn().mockReturnValue(existingRealm);
        mockDb.createLore = vi.fn().mockReturnValue(newLore);

        const result = await server.callTool('create_lore', {
          realm_path: '/test/realm',
          content: 'New architectural decision',
          why: 'To improve performance',
          type: 'decree',
          provinces: ['api', 'frontend'],
          sigils: ['architecture', 'performance'],
          confidence: 95,
        });

        expect(mockDb.findRealmByPath).toHaveBeenCalledWith('/test/realm');
        expect(mockDb.createLore).toHaveBeenCalledWith({
          realmId: 'realm-123',
          content: 'New architectural decision',
          why: 'To improve performance',
          type: 'decree',
          provinces: ['api', 'frontend'],
          sigils: ['architecture', 'performance'],
          confidence: 95,
          origin: { type: 'manual', reference: 'mcp' },
        });
        expect(result.lore).toMatchObject({
          id: 'lore-new',
          content: 'New architectural decision',
          type: 'decree',
        });
        expect(result.message).toBe('Lore created successfully');
      });

      it('should auto-create realm if not found', async () => {
        const newRealm: Realm = {
          id: 'realm-new',
          name: 'newrealm',
          path: '/nonexistent/newrealm',
          isMonorepo: false,
          provinces: [],
          lastSeen: new Date(),
          createdAt: new Date(),
        };

        const newLore: Lore = {
          id: 'lore-new',
          realmId: 'realm-new',
          content: 'Test lore',
          type: 'decree',
          provinces: [],
          sigils: [],
          confidence: 80,
          origin: { type: 'manual', reference: 'mcp' },
          status: 'living',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDb.findRealmByPath = vi.fn().mockReturnValue(null);
        mockDb.createRealm = vi.fn().mockReturnValue(newRealm);
        mockDb.createLore = vi.fn().mockReturnValue(newLore);

        const result = await server.callTool('create_lore', {
          realm_path: '/nonexistent/newrealm',
          content: 'Test lore',
          type: 'decree',
        });

        expect(mockDb.createRealm).toHaveBeenCalledWith({
          name: 'newrealm',
          path: '/nonexistent/newrealm',
          isMonorepo: false,
          provinces: [],
        });
        expect(mockDb.createLore).toHaveBeenCalled();
        expect(result.message).toBe('Realm initialized and lore created successfully');
        expect(result.realm.created).toBe(true);
      });
    });

    describe('update_lore', () => {
      it('should update an existing lore', async () => {
        const existingLore = mockLores[0]!;
        const updatedLore: Lore = {
          id: existingLore.id,
          realmId: existingLore.realmId,
          content: 'Use PostgreSQL 15 for data storage',
          why: existingLore.why,
          type: existingLore.type,
          provinces: existingLore.provinces,
          sigils: ['database', 'postgresql', 'upgrade'],
          confidence: 95,
          origin: existingLore.origin,
          status: existingLore.status,
          createdAt: existingLore.createdAt,
          updatedAt: new Date(),
        };

        mockDb.findLore = vi.fn().mockReturnValue(existingLore);
        mockDb.updateLore = vi.fn().mockReturnValue(updatedLore);
        mockDb.listRealms = vi.fn().mockReturnValue([mockRealm]);

        const result = await server.callTool('update_lore', {
          lore_id: 'lore-1',
          content: 'Use PostgreSQL 15 for data storage',
          confidence: 95,
          sigils: ['database', 'postgresql', 'upgrade'],
        });

        expect(mockDb.findLore).toHaveBeenCalledWith('lore-1');
        expect(mockDb.updateLore).toHaveBeenCalledWith('lore-1', {
          content: 'Use PostgreSQL 15 for data storage',
          confidence: 95,
          sigils: ['database', 'postgresql', 'upgrade'],
          why: undefined,
          type: undefined,
          provinces: undefined,
          status: undefined,
          origin: undefined,
        });
        expect(result.lore.content).toBe('Use PostgreSQL 15 for data storage');
        expect(result.lore.confidence).toBe(95);
        expect(result.message).toBe('Lore updated successfully');
      });

      it('should throw error if lore not found', async () => {
        mockDb.findLore = vi.fn().mockReturnValue(null);

        await expect(
          server.callTool('update_lore', {
            lore_id: 'nonexistent-lore',
            content: 'Updated content',
          })
        ).rejects.toThrow('Lore not found with ID: nonexistent-lore');
      });

      it('should update lore status', async () => {
        const existingLore = mockLores[0]!;
        const archivedLore: Lore = {
          id: existingLore.id,
          realmId: existingLore.realmId,
          content: existingLore.content,
          why: existingLore.why,
          type: existingLore.type,
          provinces: existingLore.provinces,
          sigils: existingLore.sigils,
          confidence: existingLore.confidence,
          origin: existingLore.origin,
          status: 'archived',
          createdAt: existingLore.createdAt,
          updatedAt: new Date(),
        };

        mockDb.findLore = vi.fn().mockReturnValue(existingLore);
        mockDb.updateLore = vi.fn().mockReturnValue(archivedLore);
        mockDb.listRealms = vi.fn().mockReturnValue([mockRealm]);

        const result = await server.callTool('update_lore', {
          lore_id: 'lore-1',
          status: 'archived',
        });

        expect(result.lore.status).toBe('archived');
      });
    });

    describe('delete_lore', () => {
      it('should delete a lore with confirmation', async () => {
        const loreToDelete = mockLores[0]!;
        
        mockDb.findLore = vi.fn().mockReturnValue(loreToDelete);
        mockDb.listRealms = vi.fn().mockReturnValue([mockRealm]);
        mockDb.deleteLore = vi.fn();

        const result = await server.callTool('delete_lore', {
          lore_id: 'lore-1',
          confirm: true,
        });

        expect(mockDb.findLore).toHaveBeenCalledWith('lore-1');
        expect(mockDb.deleteLore).toHaveBeenCalledWith('lore-1');
        expect(result.deleted).toBe(true);
        expect(result.lore_id).toBe('lore-1');
        expect(result.message).toBe('Lore permanently deleted');
      });

      it('should throw error without confirmation', async () => {
        await expect(
          server.callTool('delete_lore', {
            lore_id: 'lore-1',
            confirm: false,
          })
        ).rejects.toThrow('Deletion must be confirmed by setting confirm: true');
      });

      it('should throw error if lore not found', async () => {
        mockDb.findLore = vi.fn().mockReturnValue(null);

        await expect(
          server.callTool('delete_lore', {
            lore_id: 'nonexistent-lore',
            confirm: true,
          })
        ).rejects.toThrow('Lore not found with ID: nonexistent-lore');
      });
    });

    describe('archive_lore', () => {
      it('should archive an active lore', async () => {
        const activeLore = mockLores[0]!;
        const archivedLore: Lore = {
          id: activeLore.id,
          realmId: activeLore.realmId,
          content: activeLore.content,
          why: activeLore.why,
          type: activeLore.type,
          provinces: activeLore.provinces,
          sigils: activeLore.sigils,
          confidence: activeLore.confidence,
          origin: activeLore.origin,
          status: 'archived',
          createdAt: activeLore.createdAt,
          updatedAt: new Date(),
        };

        mockDb.findLore = vi.fn()
          .mockReturnValueOnce(activeLore) // First call: verify exists
          .mockReturnValueOnce(archivedLore); // Second call: after archiving
        mockDb.softDeleteLore = vi.fn();
        mockDb.listRealms = vi.fn().mockReturnValue([mockRealm]);

        const result = await server.callTool('archive_lore', {
          lore_id: 'lore-1',
        });

        expect(mockDb.softDeleteLore).toHaveBeenCalledWith('lore-1');
        expect(result.lore.status).toBe('archived');
        expect(result.message).toBe('Lore archived successfully');
      });

      it('should throw error if lore already archived', async () => {
        const archivedLore = { ...mockLores[0]!, status: 'archived' };
        mockDb.findLore = vi.fn().mockReturnValue(archivedLore);

        await expect(
          server.callTool('archive_lore', {
            lore_id: 'lore-1',
          })
        ).rejects.toThrow('Lore is already archived');
      });

      it('should throw error if lore not found', async () => {
        mockDb.findLore = vi.fn().mockReturnValue(null);

        await expect(
          server.callTool('archive_lore', {
            lore_id: 'nonexistent-lore',
          })
        ).rejects.toThrow('Lore not found with ID: nonexistent-lore');
      });
    });

    describe('restore_lore', () => {
      it('should restore an archived lore', async () => {
        const archivedLore = { ...mockLores[0]!, status: 'archived' as const };
        const restoredLore: Lore = {
          id: archivedLore.id,
          realmId: archivedLore.realmId,
          content: archivedLore.content,
          why: archivedLore.why,
          type: archivedLore.type,
          provinces: archivedLore.provinces,
          sigils: archivedLore.sigils,
          confidence: archivedLore.confidence,
          origin: archivedLore.origin,
          status: 'living',
          createdAt: archivedLore.createdAt,
          updatedAt: new Date(),
        };

        mockDb.findLore = vi.fn()
          .mockReturnValueOnce(archivedLore) // First call: verify exists and archived
          .mockReturnValueOnce(restoredLore); // Second call: after restoring
        mockDb.restoreLore = vi.fn();
        mockDb.listRealms = vi.fn().mockReturnValue([mockRealm]);

        const result = await server.callTool('restore_lore', {
          lore_id: 'lore-1',
        });

        expect(mockDb.restoreLore).toHaveBeenCalledWith('lore-1');
        expect(result.lore.status).toBe('living');
        expect(result.message).toBe('Lore restored successfully');
      });

      it('should throw error if lore not archived', async () => {
        const activeLore = mockLores[0]!;
        mockDb.findLore = vi.fn().mockReturnValue(activeLore);

        await expect(
          server.callTool('restore_lore', {
            lore_id: 'lore-1',
          })
        ).rejects.toThrow('Lore is not archived');
      });

      it('should throw error if lore not found', async () => {
        mockDb.findLore = vi.fn().mockReturnValue(null);

        await expect(
          server.callTool('restore_lore', {
            lore_id: 'nonexistent-lore',
          })
        ).rejects.toThrow('Lore not found with ID: nonexistent-lore');
      });
    });

    describe('relation tools', () => {
      const mockRelation = {
        fromLoreId: 'lore-1',
        toLoreId: 'lore-2',
        type: 'depends_on',
        strength: 1.0,
        metadata: null,
        createdAt: new Date(),
      };

      describe('create_relation', () => {
        it('should create a relation between two lores', async () => {
          mockDb.findLore = vi.fn()
            .mockReturnValueOnce(mockLores[0]) // fromLore
            .mockReturnValueOnce(mockLores[1]); // toLore
          mockDb.createRelation = vi.fn().mockReturnValue(mockRelation);

          const result = await server.callTool('create_relation', {
            from_lore_id: 'lore-1',
            to_lore_id: 'lore-2',
            type: 'depends_on',
            strength: 1.0,
          });

          expect(mockDb.createRelation).toHaveBeenCalledWith({
            fromLoreId: 'lore-1',
            toLoreId: 'lore-2',
            type: 'depends_on',
            strength: 1.0,
            metadata: undefined,
          });
          expect(result.relation.type).toBe('depends_on');
          expect(result.message).toBe('Relation created successfully');
        });

        it('should throw error if source lore not found', async () => {
          mockDb.findLore = vi.fn().mockReturnValue(null);

          await expect(
            server.callTool('create_relation', {
              from_lore_id: 'nonexistent',
              to_lore_id: 'lore-2',
              type: 'depends_on',
            })
          ).rejects.toThrow('Source lore not found with ID: nonexistent');
        });

        it('should throw error if lores are in different realms', async () => {
          const lore1 = { ...mockLores[0], realmId: 'realm-1' };
          const lore2 = { ...mockLores[1], realmId: 'realm-2' };
          
          mockDb.findLore = vi.fn()
            .mockReturnValueOnce(lore1)
            .mockReturnValueOnce(lore2);

          await expect(
            server.callTool('create_relation', {
              from_lore_id: 'lore-1',
              to_lore_id: 'lore-2',
              type: 'depends_on',
            })
          ).rejects.toThrow('Cannot create relation between lores in different realms');
        });
      });

      describe('delete_relation', () => {
        it('should delete a relation', async () => {
          mockDb.findLore = vi.fn()
            .mockReturnValueOnce(mockLores[0]) // fromLore
            .mockReturnValueOnce(mockLores[1]); // toLore
          mockDb.deleteRelation = vi.fn();

          const result = await server.callTool('delete_relation', {
            from_lore_id: 'lore-1',
            to_lore_id: 'lore-2',
            type: 'depends_on',
          });

          expect(mockDb.deleteRelation).toHaveBeenCalledWith('lore-1', 'lore-2', 'depends_on');
          expect(result.deleted).toBe(true);
          expect(result.message).toBe('Relation deleted successfully');
        });
      });

      describe('list_relations', () => {
        it('should list all relations for a lore', async () => {
          const relations = [
            mockRelation,
            {
              fromLoreId: 'lore-2',
              toLoreId: 'lore-1',
              type: 'contradicts',
              strength: 0.8,
              metadata: null,
              createdAt: new Date(),
            },
          ];

          mockDb.findLore = vi.fn()
            .mockReturnValueOnce(mockLores[0]) // main lore
            .mockReturnValueOnce(mockLores[1]); // related lore
          mockDb.listRelationsByLore = vi.fn().mockReturnValue(relations);

          const result = await server.callTool('list_relations', {
            lore_id: 'lore-1',
            direction: 'both',
          });

          expect(mockDb.listRelationsByLore).toHaveBeenCalledWith('lore-1');
          expect(result.relations).toHaveLength(2);
          expect(result.relations[0].direction).toBe('outgoing');
          expect(result.relations[1].direction).toBe('incoming');
        });

        it('should filter by direction', async () => {
          const relations = [
            mockRelation,
            {
              fromLoreId: 'lore-2',
              toLoreId: 'lore-1',
              type: 'contradicts',
              strength: 0.8,
              metadata: null,
              createdAt: new Date(),
            },
          ];

          mockDb.findLore = vi.fn().mockReturnValue(mockLores[0]);
          mockDb.listRelationsByLore = vi.fn().mockReturnValue(relations);

          const result = await server.callTool('list_relations', {
            lore_id: 'lore-1',
            direction: 'from',
          });

          expect(result.relations).toHaveLength(1);
          expect(result.relations[0].fromLoreId).toBe('lore-1');
        });
      });
    });

    describe('get_realm_stats', () => {
      it('should return comprehensive realm statistics', async () => {
        const lores = [
          ...mockLores,
          {
            id: 'lore-3',
            realmId: 'realm-123',
            content: 'High confidence decision',
            type: 'decree' as const,
            provinces: ['api'],
            sigils: ['important', 'architecture'],
            confidence: 95,
            origin: { type: 'manual' as const, reference: 'cli' },
            status: 'living' as const,
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
            updatedAt: new Date(),
          },
          {
            id: 'lore-4',
            realmId: 'realm-123',
            content: 'Low confidence assumption',
            type: 'belief' as const,
            provinces: ['frontend'],
            sigils: ['uncertain', 'review'],
            confidence: 30,
            origin: { type: 'manual' as const, reference: 'cli' },
            status: 'archived' as const,
            createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
            updatedAt: new Date(),
          },
        ];

        mockDb.findRealmByPath = vi.fn().mockReturnValue(mockRealm);
        mockDb.listLoresByRealm = vi.fn().mockReturnValue(lores);
        mockDb.listRelationsByLore = vi.fn().mockReturnValue([]);

        const result = await server.callTool('get_realm_stats', {
          realm_path: '/test/realm',
        });

        expect(mockDb.findRealmByPath).toHaveBeenCalledWith('/test/realm');
        expect(mockDb.listLoresByRealm).toHaveBeenCalledWith('realm-123');
        
        expect(result.statistics.totalLores).toBe(4);
        expect(result.statistics.loresByType.decree).toBe(3);
        expect(result.statistics.loresByType.belief).toBe(1);
        expect(result.statistics.loresByStatus.living).toBe(3);
        expect(result.statistics.loresByStatus.archived).toBe(1);
        expect(result.statistics.highConfidenceLores).toBe(2);
        expect(result.statistics.lowConfidenceLores).toBe(1);
        expect(result.statistics.averageConfidence).toBeGreaterThan(0);
        expect(result.statistics.loreGrowth.lastWeek).toBe(1);
        expect(result.statistics.topSigils.length).toBeGreaterThanOrEqual(6);
      });

      it('should throw error if realm not found', async () => {
        mockDb.findRealmByPath = vi.fn().mockReturnValue(null);

        await expect(
          server.callTool('get_realm_stats', {
            realm_path: '/nonexistent/realm',
          })
        ).rejects.toThrow('Realm not found at path: /nonexistent/realm');
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
      mockDb.findRealmByPath = vi.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(
        server.callTool('search_lores', {
          query: 'test',
          realm_path: '/test',
        })
      ).rejects.toThrow('Database connection failed');
    });
  });
});