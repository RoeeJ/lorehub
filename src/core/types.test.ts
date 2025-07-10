import { describe, it, expect } from 'vitest';
import { 
  LoreSchema,
  RelationSchema, 
  RealmSchema,
  isLore,
  isRelation,
  isRealm,
  validateLoreSafe,
  type CreateLoreInput
} from './types.js';

describe('Core Types', () => {
  describe('LoreSchema', () => {
    it('should validate a complete lore', () => {
      const validLore = {
        id: 'lore-123',
        realmId: 'realm-456',
        content: 'Use Redis for session cache',
        why: 'Needed sub-50ms response times',
        type: 'decree',  // was 'decision'
        provinces: ['auth-service', 'api-gateway'],
        sigils: ['redis', 'caching', 'performance'],
        confidence: 90,
        origin: {
          type: 'manual',
          reference: 'cli',
          context: 'implementing auth in api/auth.ts',
        },
        status: 'living',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = LoreSchema.safeParse(validLore);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('lore-123');
        expect(result.data.confidence).toBe(90);
      }
    });

    it('should reject invalid confidence values', () => {
      const invalidLore = {
        id: 'lore-123',
        realmId: 'realm-456',
        content: 'Some lore',
        type: 'decree',
        confidence: 150, // Invalid: > 100
        origin: { type: 'manual', reference: 'cli' },
      };

      const result = LoreSchema.safeParse(invalidLore);
      expect(result.success).toBe(false);
    });

    it('should reject invalid lore types', () => {
      const invalidLore = {
        id: 'lore-123',
        realmId: 'realm-456',
        content: 'Some lore',
        type: 'invalid-type', // Invalid type
        origin: { type: 'manual', reference: 'cli' },
      };

      const result = LoreSchema.safeParse(invalidLore);
      expect(result.success).toBe(false);
    });

    it('should provide default values', () => {
      const minimalLore = {
        id: 'lore-123',
        realmId: 'realm-456',
        content: 'Minimal lore',
        type: 'decree',
        origin: { type: 'manual', reference: 'cli' },
      };

      const result = LoreSchema.safeParse(minimalLore);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confidence).toBe(80);
        expect(result.data.status).toBe('living');
        expect(result.data.provinces).toEqual([]);
        expect(result.data.sigils).toEqual([]);
      }
    });
  });

  describe('RelationSchema', () => {
    it('should validate a complete relation', () => {
      const validRelation = {
        fromLoreId: 'lore-123',
        toLoreId: 'lore-456',
        type: 'succeeds',
        strength: 0.95,
        metadata: { reason: 'Performance improvements' },
        createdAt: new Date(),
      };

      const result = RelationSchema.safeParse(validRelation);
      expect(result.success).toBe(true);
    });

    it('should reject invalid strength values', () => {
      const invalidRelation = {
        fromLoreId: 'lore-123',
        toLoreId: 'lore-456',
        type: 'succeeds',
        strength: 1.5, // Invalid: > 1.0
      };

      const result = RelationSchema.safeParse(invalidRelation);
      expect(result.success).toBe(false);
    });

    it('should reject self-referential relations', () => {
      const selfRelation = {
        fromLoreId: 'lore-123',
        toLoreId: 'lore-123', // Same as fromLoreId
        type: 'succeeds',
      };

      const result = RelationSchema.safeParse(selfRelation);
      expect(result.success).toBe(false);
    });
  });

  describe('RealmSchema', () => {
    it('should validate a complete realm', () => {
      const validRealm = {
        id: 'realm-123',
        name: 'my-api',
        path: '/Users/roee/realms/my-api',
        gitRemote: 'https://github.com/roee/my-api.git',
        isMonorepo: true,
        provinces: ['auth', 'api', 'workers'],
        lastSeen: new Date(),
        createdAt: new Date(),
      };

      const result = RealmSchema.safeParse(validRealm);
      expect(result.success).toBe(true);
    });

    it('should handle minimal realm', () => {
      const minimalRealm = {
        id: 'realm-123',
        name: 'simple-realm',
        path: '/Users/roee/simple-realm',
      };

      const result = RealmSchema.safeParse(minimalRealm);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isMonorepo).toBe(false);
        expect(result.data.provinces).toEqual([]);
      }
    });

    it('should reject invalid paths', () => {
      const invalidRealm = {
        id: 'realm-123',
        name: 'realm',
        path: '', // Empty path
      };

      const result = RealmSchema.safeParse(invalidRealm);
      expect(result.success).toBe(false);
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify lores', () => {
      const validLore = {
        id: 'lore-123',
        realmId: 'realm-456',
        content: 'Test lore',
        type: 'decree',
        origin: { type: 'manual', reference: 'cli' },
      };

      expect(isLore(validLore)).toBe(true);
      expect(isLore({ invalid: 'object' })).toBe(false);
      expect(isLore(null)).toBe(false);
      expect(isLore(undefined)).toBe(false);
      
      // Test legacy alias
      expect(isLore(validLore)).toBe(true);
    });

    it('should correctly identify relations', () => {
      const validRelation = {
        fromLoreId: 'lore-123',
        toLoreId: 'lore-456',
        type: 'succeeds',
      };

      expect(isRelation(validRelation)).toBe(true);
      expect(isRelation({ invalid: 'object' })).toBe(false);
    });

    it('should correctly identify realms', () => {
      const validRealm = {
        id: 'realm-123',
        name: 'test-realm',
        path: '/test/path',
      };

      expect(isRealm(validRealm)).toBe(true);
      expect(isRealm({ invalid: 'object' })).toBe(false);
      
      // Test legacy alias
      expect(isRealm(validRealm)).toBe(true);
    });
  });

  describe('Utility Types', () => {
    it('should accept CreateLoreInput without required fields', () => {
      const input: CreateLoreInput = {
        realmId: 'realm-456',
        content: 'Test lore',
        type: 'decree',
        origin: { type: 'manual', reference: 'cli' },
      };

      const result = validateLoreSafe({
        ...input,
        id: 'lore-generated-123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('lore-generated-123');
      }
    });
    
    it('should work with legacy CreateLoreInput type', () => {
      const input: CreateLoreInput = {
        realmId: 'realm-456',  // Note: CreateLoreInput is now an alias
        content: 'Test lore via legacy type',
        type: 'decree',
        origin: { type: 'manual', reference: 'cli' },
      };

      const result = validateLoreSafe({
        ...input,
        id: 'lore-generated-456',
      });

      expect(result.success).toBe(true);
    });
  });
});