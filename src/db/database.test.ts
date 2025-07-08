import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync } from 'fs';
import { Database } from './database.js';
import type { Fact, CreateFactInput, CreateProjectInput, CreateRelationInput } from '../core/types.js';

describe('Database', () => {
  let db: Database;
  const testDbPath = ':memory:'; // Use in-memory DB for tests

  beforeEach(() => {
    db = new Database(testDbPath);
  });

  afterEach(() => {
    db.close();
  });

  describe('Initialization', () => {
    it('should create database tables on init', () => {
      const tables = db.listTables();
      expect(tables).toContain('facts');
      expect(tables).toContain('relations');
      expect(tables).toContain('projects');
      expect(tables).toContain('migrations');
    });

    it('should handle file-based database', () => {
      const fileDb = new Database('./test.db');
      expect(fileDb.listTables()).toContain('facts');
      fileDb.close();
      unlinkSync('./test.db');
    });
  });

  describe('Projects', () => {
    it('should create a project', () => {
      const input: CreateProjectInput = {
        name: 'test-project',
        path: '/Users/test/projects/test-project',
        gitRemote: 'https://github.com/test/test-project.git',
        isMonorepo: false,
        services: ['api', 'web'],
      };

      const project = db.createProject(input);
      
      expect(project.id).toBeDefined();
      expect(project.name).toBe('test-project');
      expect(project.path).toBe('/Users/test/projects/test-project');
      expect(project.services).toEqual(['api', 'web']);
    });

    it('should find project by path', () => {
      const input: CreateProjectInput = {
        name: 'test-project',
        path: '/Users/test/projects/test-project',
      };

      const created = db.createProject(input);
      const found = db.findProjectByPath('/Users/test/projects/test-project');

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should update lastSeen when accessing project', async () => {
      const project = db.createProject({
        name: 'test-project',
        path: '/test/path',
      });

      const initialLastSeen = project.lastSeen;
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = db.updateProjectLastSeen(project.id);
      expect(updated.lastSeen.getTime()).toBeGreaterThan(initialLastSeen.getTime());
    });

    it('should list all projects', () => {
      db.createProject({ name: 'project1', path: '/path1' });
      db.createProject({ name: 'project2', path: '/path2' });
      db.createProject({ name: 'project3', path: '/path3' });

      const projects = db.listProjects();
      expect(projects).toHaveLength(3);
      expect(projects.map(p => p.name)).toContain('project1');
      expect(projects.map(p => p.name)).toContain('project2');
      expect(projects.map(p => p.name)).toContain('project3');
    });
  });

  describe('Facts', () => {
    let projectId: string;

    beforeEach(() => {
      const project = db.createProject({
        name: 'test-project',
        path: '/test/path',
      });
      projectId = project.id;
    });

    it('should create a fact', () => {
      const input: CreateFactInput = {
        projectId,
        content: 'Use Redis for session storage',
        why: 'Need fast session lookups',
        type: 'decision',
        services: ['auth-service'],
        tags: ['redis', 'performance'],
        confidence: 85,
        source: {
          type: 'manual',
          reference: 'cli',
          context: 'Setting up authentication',
        },
      };

      const fact = db.createFact(input);

      expect(fact.id).toBeDefined();
      expect(fact.content).toBe('Use Redis for session storage');
      expect(fact.confidence).toBe(85);
      expect(fact.status).toBe('active');
    });

    it('should get fact by id', () => {
      const created = db.createFact({
        projectId,
        content: 'Test fact',
        type: 'learning',
        source: { type: 'manual', reference: 'test' },
      });

      const found = db.getFactById(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should list facts by project', () => {
      db.createFact({
        projectId,
        content: 'Fact 1',
        type: 'decision',
        source: { type: 'manual', reference: 'test' },
      });

      db.createFact({
        projectId,
        content: 'Fact 2',
        type: 'learning',
        source: { type: 'manual', reference: 'test' },
      });

      const facts = db.listFactsByProject(projectId);
      expect(facts).toHaveLength(2);
    });

    it('should update fact status', async () => {
      const fact = db.createFact({
        projectId,
        content: 'Old decision',
        type: 'decision',
        source: { type: 'manual', reference: 'test' },
      });

      // Wait to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = db.updateFactStatus(fact.id, 'superseded');
      expect(updated.status).toBe('superseded');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(fact.updatedAt.getTime());
    });

    it('should search facts by content', () => {
      db.createFact({
        projectId,
        content: 'Use PostgreSQL for data storage',
        type: 'decision',
        source: { type: 'manual', reference: 'test' },
      });

      db.createFact({
        projectId,
        content: 'Redis for caching layer',
        type: 'decision',
        source: { type: 'manual', reference: 'test' },
      });

      const results = db.searchFacts(projectId, 'Redis');
      expect(results).toHaveLength(1);
      expect(results[0]?.content).toContain('Redis');
    });

    it('should filter facts by type', () => {
      db.createFact({
        projectId,
        content: 'Decision fact',
        type: 'decision',
        source: { type: 'manual', reference: 'test' },
      });

      db.createFact({
        projectId,
        content: 'Learning fact',
        type: 'learning',
        source: { type: 'manual', reference: 'test' },
      });

      const decisions = db.listFactsByType(projectId, 'decision');
      expect(decisions).toHaveLength(1);
      expect(decisions[0]?.type).toBe('decision');
    });

    it('should filter facts by service', () => {
      db.createFact({
        projectId,
        content: 'Auth fact',
        type: 'decision',
        services: ['auth-service', 'api-gateway'],
        source: { type: 'manual', reference: 'test' },
      });

      db.createFact({
        projectId,
        content: 'Worker fact',
        type: 'decision',
        services: ['worker-service'],
        source: { type: 'manual', reference: 'test' },
      });

      const authFacts = db.listFactsByService(projectId, 'auth-service');
      expect(authFacts).toHaveLength(1);
      expect(authFacts[0]?.services).toContain('auth-service');
    });
  });

  describe('Relations', () => {
    let projectId: string;
    let fact1: Fact;
    let fact2: Fact;

    beforeEach(() => {
      const project = db.createProject({
        name: 'test-project',
        path: '/test/path',
      });
      projectId = project.id;

      fact1 = db.createFact({
        projectId,
        content: 'Use MongoDB',
        type: 'decision',
        source: { type: 'manual', reference: 'test' },
      });

      fact2 = db.createFact({
        projectId,
        content: 'Use PostgreSQL',
        type: 'decision',
        source: { type: 'manual', reference: 'test' },
      });
    });

    it('should create a relation between facts', () => {
      const input: CreateRelationInput = {
        fromFactId: fact2.id,
        toFactId: fact1.id,
        type: 'supersedes',
        strength: 0.9,
        metadata: { reason: 'Better performance' },
      };

      const relation = db.createRelation(input);

      expect(relation.fromFactId).toBe(fact2.id);
      expect(relation.toFactId).toBe(fact1.id);
      expect(relation.type).toBe('supersedes');
      expect(relation.strength).toBe(0.9);
    });

    it('should list relations for a fact', () => {
      db.createRelation({
        fromFactId: fact2.id,
        toFactId: fact1.id,
        type: 'supersedes',
      });

      const outgoing = db.listRelationsByFact(fact2.id, 'from');
      expect(outgoing).toHaveLength(1);
      expect(outgoing[0]?.toFactId).toBe(fact1.id);

      const incoming = db.listRelationsByFact(fact1.id, 'to');
      expect(incoming).toHaveLength(1);
      expect(incoming[0]?.fromFactId).toBe(fact2.id);
    });

    it('should prevent duplicate relations', () => {
      db.createRelation({
        fromFactId: fact1.id,
        toFactId: fact2.id,
        type: 'relates_to',
      });

      expect(() => {
        db.createRelation({
          fromFactId: fact1.id,
          toFactId: fact2.id,
          type: 'relates_to',
        });
      }).toThrow();
    });

    it('should delete relations when fact is deleted', () => {
      db.createRelation({
        fromFactId: fact1.id,
        toFactId: fact2.id,
        type: 'relates_to',
      });

      db.deleteFact(fact1.id);

      const relations = db.listRelationsByFact(fact2.id, 'to');
      expect(relations).toHaveLength(0);
    });
  });

  describe('Transactions', () => {
    it('should rollback on error', () => {
      const project = db.createProject({
        name: 'test-project',
        path: '/test/path',
      });

      const factCount = db.listFactsByProject(project.id).length;

      expect(() => {
        db.transaction(() => {
          db.createFact({
            projectId: project.id,
            content: 'Fact 1',
            type: 'decision',
            source: { type: 'manual', reference: 'test' },
          });

          // This should cause an error
          throw new Error('Rollback test');
        });
      }).toThrow('Rollback test');

      // Fact should not have been created
      expect(db.listFactsByProject(project.id)).toHaveLength(factCount);
    });

    it('should commit successful transactions', () => {
      const project = db.createProject({
        name: 'test-project',
        path: '/test/path',
      });

      let fact1: Fact;
      let fact2: Fact;

      db.transaction(() => {
        fact1 = db.createFact({
          projectId: project.id,
          content: 'Fact 1',
          type: 'decision',
          source: { type: 'manual', reference: 'test' },
        });

        fact2 = db.createFact({
          projectId: project.id,
          content: 'Fact 2',
          type: 'learning',
          source: { type: 'manual', reference: 'test' },
        });

        db.createRelation({
          fromFactId: fact1!.id,
          toFactId: fact2!.id,
          type: 'relates_to',
        });
      });

      expect(db.listFactsByProject(project.id)).toHaveLength(2);
      expect(db.listRelationsByFact(fact1!.id, 'from')).toHaveLength(1);
    });
  });

  describe('Performance', () => {
    it('should handle bulk inserts efficiently', () => {
      const project = db.createProject({
        name: 'perf-test',
        path: '/perf/test',
      });

      const start = Date.now();
      
      db.transaction(() => {
        for (let i = 0; i < 1000; i++) {
          db.createFact({
            projectId: project.id,
            content: `Fact ${i}`,
            type: 'learning',
            tags: [`tag${i % 10}`, `category${i % 5}`],
            source: { type: 'manual', reference: 'bulk-test' },
          });
        }
      });

      const duration = Date.now() - start;
      
      expect(db.listFactsByProject(project.id)).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should search efficiently with indexes', () => {
      const project = db.createProject({
        name: 'search-test',
        path: '/search/test',
      });

      // Create many facts
      for (let i = 0; i < 100; i++) {
        db.createFact({
          projectId: project.id,
          content: `Important decision about ${i % 10 === 0 ? 'Redis' : 'something else'}`,
          type: 'decision',
          source: { type: 'manual', reference: 'test' },
        });
      }

      const start = Date.now();
      const results = db.searchFacts(project.id, 'Redis');
      const duration = Date.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(50); // Search should be fast
    });
  });
});