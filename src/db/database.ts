import BetterSqlite3 from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type {
  Fact,
  Project,
  Relation,
  CreateFactInput,
  CreateProjectInput,
  CreateRelationInput,
  FactType,
  FactStatus,
} from '../core/types.js';
import { validateFact, validateProject, validateRelation } from '../core/types.js';

export class Database {
  private db: SqliteDatabase;

  constructor(path: string = ':memory:') {
    this.db = new BetterSqlite3(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.init();
  }

  private init(): void {
    this.createTables();
    this.createIndexes();
  }

  private createTables(): void {
    // Migrations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Projects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        git_remote TEXT,
        is_monorepo INTEGER NOT NULL DEFAULT 0,
        services TEXT NOT NULL DEFAULT '[]',
        last_seen TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Facts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS facts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        content TEXT NOT NULL,
        why TEXT,
        type TEXT NOT NULL,
        services TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        confidence INTEGER NOT NULL DEFAULT 80,
        source TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // Relations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relations (
        from_fact_id TEXT NOT NULL,
        to_fact_id TEXT NOT NULL,
        type TEXT NOT NULL,
        strength REAL NOT NULL DEFAULT 1.0,
        metadata TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (from_fact_id, to_fact_id, type),
        FOREIGN KEY (from_fact_id) REFERENCES facts(id) ON DELETE CASCADE,
        FOREIGN KEY (to_fact_id) REFERENCES facts(id) ON DELETE CASCADE
      )
    `);
  }

  private createIndexes(): void {
    // Performance indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_facts_project_id ON facts(project_id);
      CREATE INDEX IF NOT EXISTS idx_facts_type ON facts(type);
      CREATE INDEX IF NOT EXISTS idx_facts_status ON facts(status);
      CREATE INDEX IF NOT EXISTS idx_facts_content ON facts(content);
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_fact_id);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_fact_id);
    `);
  }

  close(): void {
    this.db.close();
  }

  listTables(): string[] {
    const tables = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{ name: string }>;
    
    return tables.map(t => t.name);
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // Project operations
  createProject(input: CreateProjectInput): Project {
    const id = input.id || `proj-${randomUUID()}`;
    const now = new Date();
    
    const project: Project = validateProject({
      ...input,
      id,
      createdAt: input.createdAt || now,
      lastSeen: input.lastSeen || now,
    });

    this.db.prepare(`
      INSERT INTO projects (id, name, path, git_remote, is_monorepo, services, last_seen, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project.id,
      project.name,
      project.path,
      project.gitRemote || null,
      project.isMonorepo ? 1 : 0,
      JSON.stringify(project.services),
      project.lastSeen.toISOString(),
      project.createdAt.toISOString()
    );

    return project;
  }

  findProjectByPath(path: string): Project | null {
    const row = this.db.prepare(`
      SELECT * FROM projects WHERE path = ?
    `).get(path) as any;

    if (!row) return null;

    return this.rowToProject(row);
  }

  updateProjectLastSeen(projectId: string): Project {
    const now = new Date();
    
    this.db.prepare(`
      UPDATE projects SET last_seen = ? WHERE id = ?
    `).run(now.toISOString(), projectId);

    const row = this.db.prepare(`
      SELECT * FROM projects WHERE id = ?
    `).get(projectId) as any;

    return this.rowToProject(row);
  }

  listProjects(): Project[] {
    const rows = this.db.prepare(`
      SELECT * FROM projects ORDER BY last_seen DESC
    `).all() as any[];

    return rows.map(row => this.rowToProject(row));
  }

  private rowToProject(row: any): Project {
    return validateProject({
      id: row.id,
      name: row.name,
      path: row.path,
      gitRemote: row.git_remote || undefined,
      isMonorepo: row.is_monorepo === 1,
      services: JSON.parse(row.services),
      lastSeen: new Date(row.last_seen),
      createdAt: new Date(row.created_at),
    });
  }

  // Fact operations
  createFact(input: CreateFactInput): Fact {
    const id = input.id || `fact-${randomUUID()}`;
    const now = new Date();
    
    const fact: Fact = validateFact({
      ...input,
      id,
      createdAt: input.createdAt || now,
      updatedAt: input.updatedAt || now,
    });

    this.db.prepare(`
      INSERT INTO facts (
        id, project_id, content, why, type, services, tags, 
        confidence, source, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fact.id,
      fact.projectId,
      fact.content,
      fact.why || null,
      fact.type,
      JSON.stringify(fact.services),
      JSON.stringify(fact.tags),
      fact.confidence,
      JSON.stringify(fact.source),
      fact.status,
      fact.createdAt.toISOString(),
      fact.updatedAt.toISOString()
    );

    return fact;
  }

  getFactById(id: string): Fact | null {
    const row = this.db.prepare(`
      SELECT * FROM facts WHERE id = ?
    `).get(id) as any;

    if (!row) return null;

    return this.rowToFact(row);
  }

  listFactsByProject(projectId: string): Fact[] {
    const rows = this.db.prepare(`
      SELECT * FROM facts WHERE project_id = ? ORDER BY created_at DESC
    `).all(projectId) as any[];

    return rows.map(row => this.rowToFact(row));
  }

  listFactsByType(projectId: string, type: FactType): Fact[] {
    const rows = this.db.prepare(`
      SELECT * FROM facts 
      WHERE project_id = ? AND type = ? 
      ORDER BY created_at DESC
    `).all(projectId, type) as any[];

    return rows.map(row => this.rowToFact(row));
  }

  listFactsByService(projectId: string, service: string): Fact[] {
    const rows = this.db.prepare(`
      SELECT * FROM facts 
      WHERE project_id = ? AND services LIKE ? 
      ORDER BY created_at DESC
    `).all(projectId, `%"${service}"%`) as any[];

    return rows.map(row => this.rowToFact(row));
  }

  updateFactStatus(factId: string, status: FactStatus): Fact {
    const now = new Date();
    
    this.db.prepare(`
      UPDATE facts SET status = ?, updated_at = ? WHERE id = ?
    `).run(status, now.toISOString(), factId);

    return this.getFactById(factId)!;
  }

  searchFacts(projectId: string, query: string): Fact[] {
    // Convert wildcard syntax to SQL LIKE pattern
    let sqlPattern = query
      .replace(/\*/g, '%')  // Replace * with %
      .replace(/\?/g, '_'); // Replace ? with _
    
    // If no wildcards were present, add % around the query for substring match
    if (!query.includes('*') && !query.includes('?')) {
      sqlPattern = `%${sqlPattern}%`;
    }
    
    const rows = this.db.prepare(`
      SELECT * FROM facts 
      WHERE project_id = ? AND LOWER(content) LIKE LOWER(?) 
      ORDER BY created_at DESC
    `).all(projectId, sqlPattern) as any[];

    return rows.map(row => this.rowToFact(row));
  }

  deleteFact(factId: string): void {
    this.db.prepare(`DELETE FROM facts WHERE id = ?`).run(factId);
  }

  private rowToFact(row: any): Fact {
    return validateFact({
      id: row.id,
      projectId: row.project_id,
      content: row.content,
      why: row.why || undefined,
      type: row.type,
      services: JSON.parse(row.services),
      tags: JSON.parse(row.tags),
      confidence: row.confidence,
      source: JSON.parse(row.source),
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  // Relation operations
  createRelation(input: CreateRelationInput): Relation {
    const now = new Date();
    
    const relation: Relation = validateRelation({
      ...input,
      createdAt: input.createdAt || now,
    });

    this.db.prepare(`
      INSERT INTO relations (from_fact_id, to_fact_id, type, strength, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      relation.fromFactId,
      relation.toFactId,
      relation.type,
      relation.strength,
      relation.metadata ? JSON.stringify(relation.metadata) : null,
      relation.createdAt.toISOString()
    );

    return relation;
  }

  listRelationsByFact(factId: string, direction: 'from' | 'to' | 'both' = 'both'): Relation[] {
    let query: string;
    let params: string[];

    if (direction === 'from') {
      query = `SELECT * FROM relations WHERE from_fact_id = ?`;
      params = [factId];
    } else if (direction === 'to') {
      query = `SELECT * FROM relations WHERE to_fact_id = ?`;
      params = [factId];
    } else {
      query = `SELECT * FROM relations WHERE from_fact_id = ? OR to_fact_id = ?`;
      params = [factId, factId];
    }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => this.rowToRelation(row));
  }

  private rowToRelation(row: any): Relation {
    return validateRelation({
      fromFactId: row.from_fact_id,
      toFactId: row.to_fact_id,
      type: row.type,
      strength: row.strength,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
    });
  }
}