import { describe, it, expect } from 'vitest';
import { 
  FactSchema, 
  RelationSchema, 
  ProjectSchema,
  isFact,
  isRelation,
  isProject,
  validateFactSafe,
  type CreateFactInput
} from './types.js';

describe('Core Types', () => {
  describe('FactSchema', () => {
    it('should validate a complete fact', () => {
      const validFact = {
        id: 'fact-123',
        projectId: 'proj-456',
        content: 'Use Redis for session cache',
        why: 'Needed sub-50ms response times',
        type: 'decision',
        services: ['auth-service', 'api-gateway'],
        tags: ['redis', 'caching', 'performance'],
        confidence: 90,
        source: {
          type: 'manual',
          reference: 'cli',
          context: 'implementing auth in api/auth.ts',
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = FactSchema.safeParse(validFact);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('fact-123');
        expect(result.data.confidence).toBe(90);
      }
    });

    it('should reject invalid confidence values', () => {
      const invalidFact = {
        id: 'fact-123',
        projectId: 'proj-456',
        content: 'Some fact',
        type: 'decision',
        confidence: 150, // Invalid: > 100
        source: { type: 'manual', reference: 'cli' },
      };

      const result = FactSchema.safeParse(invalidFact);
      expect(result.success).toBe(false);
    });

    it('should reject invalid fact types', () => {
      const invalidFact = {
        id: 'fact-123',
        projectId: 'proj-456',
        content: 'Some fact',
        type: 'invalid-type', // Invalid type
        source: { type: 'manual', reference: 'cli' },
      };

      const result = FactSchema.safeParse(invalidFact);
      expect(result.success).toBe(false);
    });

    it('should provide default values', () => {
      const minimalFact = {
        id: 'fact-123',
        projectId: 'proj-456',
        content: 'Minimal fact',
        type: 'decision',
        source: { type: 'manual', reference: 'cli' },
      };

      const result = FactSchema.safeParse(minimalFact);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confidence).toBe(80);
        expect(result.data.status).toBe('active');
        expect(result.data.services).toEqual([]);
        expect(result.data.tags).toEqual([]);
      }
    });
  });

  describe('RelationSchema', () => {
    it('should validate a complete relation', () => {
      const validRelation = {
        fromFactId: 'fact-123',
        toFactId: 'fact-456',
        type: 'supersedes',
        strength: 0.95,
        metadata: { reason: 'Performance improvements' },
        createdAt: new Date(),
      };

      const result = RelationSchema.safeParse(validRelation);
      expect(result.success).toBe(true);
    });

    it('should reject invalid strength values', () => {
      const invalidRelation = {
        fromFactId: 'fact-123',
        toFactId: 'fact-456',
        type: 'supersedes',
        strength: 1.5, // Invalid: > 1.0
      };

      const result = RelationSchema.safeParse(invalidRelation);
      expect(result.success).toBe(false);
    });

    it('should reject self-referential relations', () => {
      const selfRelation = {
        fromFactId: 'fact-123',
        toFactId: 'fact-123', // Same as fromFactId
        type: 'supersedes',
      };

      const result = RelationSchema.safeParse(selfRelation);
      expect(result.success).toBe(false);
    });
  });

  describe('ProjectSchema', () => {
    it('should validate a complete project', () => {
      const validProject = {
        id: 'proj-123',
        name: 'my-api',
        path: '/Users/roee/projects/my-api',
        gitRemote: 'https://github.com/roee/my-api.git',
        isMonorepo: true,
        services: ['auth', 'api', 'workers'],
        lastSeen: new Date(),
        createdAt: new Date(),
      };

      const result = ProjectSchema.safeParse(validProject);
      expect(result.success).toBe(true);
    });

    it('should handle minimal project', () => {
      const minimalProject = {
        id: 'proj-123',
        name: 'simple-project',
        path: '/Users/roee/simple-project',
      };

      const result = ProjectSchema.safeParse(minimalProject);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isMonorepo).toBe(false);
        expect(result.data.services).toEqual([]);
      }
    });

    it('should reject invalid paths', () => {
      const invalidProject = {
        id: 'proj-123',
        name: 'project',
        path: '', // Empty path
      };

      const result = ProjectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify facts', () => {
      const validFact = {
        id: 'fact-123',
        projectId: 'proj-456',
        content: 'Test fact',
        type: 'decision',
        source: { type: 'manual', reference: 'cli' },
      };

      expect(isFact(validFact)).toBe(true);
      expect(isFact({ invalid: 'object' })).toBe(false);
      expect(isFact(null)).toBe(false);
      expect(isFact(undefined)).toBe(false);
    });

    it('should correctly identify relations', () => {
      const validRelation = {
        fromFactId: 'fact-123',
        toFactId: 'fact-456',
        type: 'supersedes',
      };

      expect(isRelation(validRelation)).toBe(true);
      expect(isRelation({ invalid: 'object' })).toBe(false);
    });

    it('should correctly identify projects', () => {
      const validProject = {
        id: 'proj-123',
        name: 'test-project',
        path: '/test/path',
      };

      expect(isProject(validProject)).toBe(true);
      expect(isProject({ invalid: 'object' })).toBe(false);
    });
  });

  describe('Utility Types', () => {
    it('should accept CreateFactInput without required fields', () => {
      const input: CreateFactInput = {
        projectId: 'proj-456',
        content: 'Test fact',
        type: 'decision',
        source: { type: 'manual', reference: 'cli' },
      };

      const result = validateFactSafe({
        ...input,
        id: 'fact-generated-123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('fact-generated-123');
      }
    });
  });
});