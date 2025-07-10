import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from './database.js';
import type { CreateLoreInput } from '../core/types.js';

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
    console.log('Tables created:', tables);
    
    // Check for the new table names
    expect(tables).toContain('realms');
    expect(tables).toContain('lores');
    expect(tables).toContain('lore_relations');
    expect(tables).toContain('__drizzle_migrations');
  });

  it('should create and retrieve a realm', () => {
    const realm = db.createRealm({
      name: 'test-realm',
      path: '/test/path',
      gitRemote: 'https://github.com/test/repo.git',
    });

    expect(realm.name).toBe('test-realm');
    expect(realm.gitRemote).toBe('https://github.com/test/repo.git');

    const found = db.findRealmByPath('/test/path');
    expect(found).toBeDefined();
    expect(found?.id).toBe(realm.id);
  });

  it('should create and retrieve lores', async () => {
    const realm = db.createRealm({
      name: 'test-realm',
      path: '/test/path',
    });

    const loreInput: CreateLoreInput = {
      realmId: realm.id,
      content: 'Test lore content',
      type: 'decree',
      origin: {
        type: 'manual',
        reference: 'test',
      },
    };

    const lore = await db.createLore(loreInput);
    expect(lore.content).toBe('Test lore content');
    expect(lore.status).toBe('living');

    const lores = db.listLoresByRealm(realm.id);
    expect(lores).toHaveLength(1);
    expect(lores[0]?.id).toBe(lore.id);
  });

  it('should soft delete lores', async () => {
    const realm = db.createRealm({
      name: 'test-realm',
      path: '/test/path',
    });

    const lore = await db.createLore({
      realmId: realm.id,
      content: 'To be deleted',
      type: 'decree',
      origin: { type: 'manual', reference: 'test' },
    });

    db.softDeleteLore(lore.id);

    const updatedLore = db.findLore(lore.id);
    expect(updatedLore?.status).toBe('archived');
  });
});