import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from './database.js';
import type { CreateFactInput } from '../core/types.js';

describe('Database', () => {
  let db: Database;

  beforeEach(() => {
    // Use in-memory database for tests
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('should initialize with drizzle migrations', () => {
    // Check that tables were created
    const tables = db.listTables();
    expect(tables).toContain('projects');
    expect(tables).toContain('facts');
    expect(tables).toContain('relations');
    expect(tables).toContain('__drizzle_migrations');
  });

  it('should create and retrieve a project', () => {
    const project = db.createProject({
      name: 'test-project',
      path: '/test/path',
      gitRemote: 'https://github.com/test/repo.git',
    });

    expect(project.name).toBe('test-project');
    expect(project.gitRemote).toBe('https://github.com/test/repo.git');

    const found = db.findProjectByPath('/test/path');
    expect(found).toBeDefined();
    expect(found?.id).toBe(project.id);
  });

  it('should create and retrieve facts', () => {
    const project = db.createProject({
      name: 'test-project',
      path: '/test/path',
    });

    const factInput: CreateFactInput = {
      projectId: project.id,
      content: 'Test fact content',
      type: 'decision',
      source: {
        type: 'manual',
        reference: 'test',
      },
    };

    const fact = db.createFact(factInput);
    expect(fact.content).toBe('Test fact content');
    expect(fact.status).toBe('active');

    const facts = db.listFactsByProject(project.id);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.id).toBe(fact.id);
  });

  it('should soft delete facts', () => {
    const project = db.createProject({
      name: 'test-project',
      path: '/test/path',
    });

    const fact = db.createFact({
      projectId: project.id,
      content: 'To be deleted',
      type: 'decision',
      source: { type: 'manual', reference: 'test' },
    });

    db.softDeleteFact(fact.id);

    const updatedFact = db.findFact(fact.id);
    expect(updatedFact?.status).toBe('archived');
  });
});