import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, like, or, sql, desc } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import BetterSqlite3 from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from '../utils/uuid.js';
import { projects, facts, relations, type Project as DbProject, type Fact as DbFact, type Relation as DbRelation } from './schema.js';
import type { 
  Fact, 
  FactType, 
  FactStatus, 
  CreateFactInput, 
  UpdateFactInput,
  Project,
  CreateProjectInput,
  CreateRelationInput,
  Relation
} from '../core/types.js';

export class Database {
  private sqlite: BetterSqlite3.Database;
  private db: ReturnType<typeof drizzle>;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dbDir = dirname(dbPath);
    if (dbDir && !existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    
    this.sqlite = new BetterSqlite3(dbPath);
    
    // Configure SQLite for better performance
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('synchronous = NORMAL');
    this.sqlite.pragma('foreign_keys = ON');
    
    this.db = drizzle(this.sqlite);
    
    // Run Drizzle migrations
    this.runMigrations();
  }

  private runMigrations(): void {
    try {
      // Get the directory where this file is located
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      
      // Try different locations for migrations
      let migrationsFolder = join(__dirname, '..', 'drizzle'); // dist/drizzle
      if (!existsSync(migrationsFolder)) {
        migrationsFolder = join(__dirname, '..', '..', '..', 'drizzle'); // project root drizzle
      }
      
      // For in-memory databases in tests, we need special handling
      if (this.sqlite.name === ':memory:') {
        if (!existsSync(migrationsFolder)) {
          throw new Error(
            `Drizzle migrations folder not found for tests. Expected at: ${join(__dirname, '..', 'drizzle')} or ${join(__dirname, '..', '..', '..', 'drizzle')}`
          );
        }
        // For in-memory databases, we need to run migrations synchronously
        this.runMigrationsForInMemory(migrationsFolder);
        return;
      }
      
      if (!existsSync(migrationsFolder)) {
        throw new Error(
          `Drizzle migrations folder not found. Expected at: ${join(__dirname, '..', 'drizzle')} or ${join(__dirname, '..', '..', '..', 'drizzle')}`
        );
      }
      
      // Run migrations
      migrate(this.db, { migrationsFolder });
    } catch (error) {
      // If migrations fail, it might be because tables already exist
      // This is okay for existing databases
      if (error instanceof Error && error.message.includes('already exists')) {
        // Tables exist, that's fine
        return;
      }
      throw error;
    }
  }
  
  private runMigrationsForInMemory(migrationsFolder: string): void {
    // For in-memory databases, we need to read and execute migrations directly
    const journalPath = join(migrationsFolder, 'meta', '_journal.json');
    
    if (!existsSync(journalPath)) {
      throw new Error(`Migration journal not found at: ${journalPath}`);
    }
    
    const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
    
    // Create migrations table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash text NOT NULL UNIQUE,
        created_at numeric
      );
    `);
    
    // Run each migration in order
    for (const entry of journal.entries) {
      const migrationPath = join(migrationsFolder, `${entry.tag}.sql`);
      
      if (!existsSync(migrationPath)) {
        throw new Error(`Migration file not found: ${migrationPath}`);
      }
      
      // Check if migration was already applied
      const existing = this.sqlite.prepare(
        'SELECT hash FROM __drizzle_migrations WHERE hash = ?'
      ).get(entry.tag);
      
      if (!existing) {
        // Read and execute migration
        const migrationSQL = readFileSync(migrationPath, 'utf-8');
        
        // Split by statement breakpoint and execute each statement
        const statements = migrationSQL.split('--> statement-breakpoint');
        
        for (const statement of statements) {
          const trimmed = statement.trim();
          if (trimmed) {
            this.sqlite.exec(trimmed);
          }
        }
        
        // Record migration as applied
        this.sqlite.prepare(
          'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)'
        ).run(entry.tag, Date.now());
      }
    }
  }

  close(): void {
    this.sqlite.close();
  }
  
  // Testing utility
  listTables(): string[] {
    const tables = this.sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as { name: string }[];
    
    return tables.map(t => t.name);
  }

  // Transaction support
  transaction<T>(fn: () => T): T {
    return this.sqlite.transaction(fn)();
  }

  // Project methods
  createProject(input: CreateProjectInput): Project {
    const id = input.id || uuidv4();
    const now = new Date();
    
    const project = {
      id,
      name: input.name,
      path: input.path,
      gitRemote: input.gitRemote || null,
      isMonorepo: input.isMonorepo || false,
      services: JSON.stringify(input.services || []),
      lastSeen: (input.lastSeen || now).toISOString(),
      createdAt: (input.createdAt || now).toISOString(),
    };

    this.db.insert(projects).values(project).run();
    
    return this.findProject(id)!;
  }

  findProject(id: string): Project | null {
    const result = this.db.select().from(projects).where(eq(projects.id, id)).get();
    return result ? this.dbProjectToProject(result) : null;
  }

  findProjectByPath(path: string): Project | null {
    const result = this.db.select().from(projects).where(eq(projects.path, path)).get();
    return result ? this.dbProjectToProject(result) : null;
  }

  updateProjectLastSeen(id: string): Project | null {
    this.db.update(projects)
      .set({ lastSeen: new Date().toISOString() })
      .where(eq(projects.id, id))
      .run();
    
    return this.findProject(id);
  }

  listProjects(): Project[] {
    const results = this.db.select().from(projects).orderBy(desc(projects.lastSeen)).all();
    return results.map(p => this.dbProjectToProject(p));
  }

  // Fact methods
  createFact(input: CreateFactInput): Fact {
    const id = input.id || uuidv4();
    const now = new Date();
    
    const fact = {
      id,
      projectId: input.projectId,
      content: input.content,
      why: input.why || null,
      type: input.type,
      services: JSON.stringify(input.services || []),
      tags: JSON.stringify(input.tags || []),
      confidence: input.confidence || 80,
      source: JSON.stringify(input.source),
      status: input.status || 'active',
      createdAt: (input.createdAt || now).toISOString(),
      updatedAt: (input.updatedAt || now).toISOString(),
    };

    this.db.insert(facts).values(fact).run();
    
    return this.findFact(id)!;
  }

  findFact(id: string): Fact | null {
    const result = this.db.select().from(facts).where(eq(facts.id, id)).get();
    return result ? this.dbFactToFact(result) : null;
  }
  
  // Alias for compatibility
  getFactById(id: string): Fact | null {
    return this.findFact(id);
  }

  updateFact(id: string, input: UpdateFactInput): Fact | null {
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (input.content !== undefined) updates.content = input.content;
    if (input.why !== undefined) updates.why = input.why;
    if (input.type !== undefined) updates.type = input.type;
    if (input.services !== undefined) updates.services = JSON.stringify(input.services);
    if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);
    if (input.confidence !== undefined) updates.confidence = input.confidence;
    if (input.source !== undefined) updates.source = JSON.stringify(input.source);
    if (input.status !== undefined) updates.status = input.status;

    this.db.update(facts).set(updates).where(eq(facts.id, id)).run();
    
    return this.findFact(id);
  }
  
  // Alias for compatibility
  updateFactStatus(id: string, status: FactStatus): void {
    this.updateFact(id, { status });
  }

  deleteFact(id: string): void {
    this.db.delete(facts).where(eq(facts.id, id)).run();
  }

  softDeleteFact(id: string): void {
    this.db.update(facts)
      .set({ 
        status: 'archived',
        updatedAt: new Date().toISOString()
      })
      .where(eq(facts.id, id))
      .run();
  }

  restoreFact(id: string): void {
    this.db.update(facts)
      .set({ 
        status: 'active',
        updatedAt: new Date().toISOString()
      })
      .where(eq(facts.id, id))
      .run();
  }

  listFactsByProject(projectId: string): Fact[] {
    const results = this.db.select()
      .from(facts)
      .where(eq(facts.projectId, projectId))
      .orderBy(desc(facts.createdAt))
      .all();
    
    return results.map(f => this.dbFactToFact(f));
  }

  listFactsByType(projectId: string, type: FactType): Fact[] {
    const results = this.db.select()
      .from(facts)
      .where(and(eq(facts.projectId, projectId), eq(facts.type, type)))
      .orderBy(desc(facts.createdAt))
      .all();
    
    return results.map(f => this.dbFactToFact(f));
  }

  listFactsByService(projectId: string, service: string): Fact[] {
    // Use SQL LIKE with JSON array search pattern
    const results = this.db.select()
      .from(facts)
      .where(and(
        eq(facts.projectId, projectId),
        like(facts.services, `%"${service}"%`)
      ))
      .orderBy(desc(facts.createdAt))
      .all();
    
    return results.map(f => this.dbFactToFact(f));
  }

  searchFacts(projectId: string, query: string, limit?: number): Fact[] {
    // Convert wildcards to SQL patterns
    const pattern = `%${query.replace(/\*/g, '%').replace(/\?/g, '_')}%`;
    
    const baseQuery = this.db.select()
      .from(facts)
      .where(and(
        eq(facts.projectId, projectId),
        or(
          like(facts.content, pattern),
          like(facts.tags, pattern)
        )
      ))
      .orderBy(desc(facts.createdAt));
    
    const results = limit ? baseQuery.limit(limit).all() : baseQuery.all();
    return results.map(f => this.dbFactToFact(f));
  }

  searchFactsGlobal(query: string, limit?: number): Fact[] {
    // Convert wildcards to SQL patterns
    const pattern = `%${query.replace(/\*/g, '%').replace(/\?/g, '_')}%`;
    
    const baseQuery = this.db.select()
      .from(facts)
      .where(or(
        like(facts.content, pattern),
        like(facts.tags, pattern)
      ))
      .orderBy(desc(facts.createdAt));
    
    const results = limit ? baseQuery.limit(limit).all() : baseQuery.all();
    return results.map(f => this.dbFactToFact(f));
  }

  getProjectFactCount(projectId: string): number {
    const result = this.db.select({ count: sql<number>`count(*)` })
      .from(facts)
      .where(eq(facts.projectId, projectId))
      .get();
    
    return result?.count || 0;
  }

  // Relation methods
  createRelation(input: CreateRelationInput): Relation {
    const relation = {
      fromFactId: input.fromFactId,
      toFactId: input.toFactId,
      type: input.type,
      strength: input.strength || 1.0,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: (input.createdAt || new Date()).toISOString(),
    };

    this.db.insert(relations).values(relation).run();
    
    return this.dbRelationToRelation(relation as DbRelation);
  }

  listRelationsByFact(factId: string): Relation[] {
    const results = this.db.select()
      .from(relations)
      .where(or(
        eq(relations.fromFactId, factId),
        eq(relations.toFactId, factId)
      ))
      .all();
    
    return results.map(r => this.dbRelationToRelation(r));
  }

  deleteRelation(fromFactId: string, toFactId: string, type: string): void {
    this.db.delete(relations)
      .where(and(
        eq(relations.fromFactId, fromFactId),
        eq(relations.toFactId, toFactId),
        eq(relations.type, type)
      ))
      .run();
  }

  // Export/Import methods
  exportData(projectId?: string): {
    projects: Project[];
    facts: Fact[];
    relations: Relation[];
  } {
    if (projectId) {
      const project = this.findProject(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }
      
      const projectFacts = this.listFactsByProject(projectId);
      const factIds = new Set(projectFacts.map(f => f.id));
      
      const relevantRelations = this.db.select()
        .from(relations)
        .all()
        .filter(r => factIds.has(r.fromFactId) || factIds.has(r.toFactId))
        .map(r => this.dbRelationToRelation(r));
      
      return {
        projects: [project],
        facts: projectFacts,
        relations: relevantRelations,
      };
    }
    
    return {
      projects: this.listProjects(),
      facts: this.searchFactsGlobal('*'),
      relations: this.db.select().from(relations).all().map(r => this.dbRelationToRelation(r)),
    };
  }

  importData(
    data: {
      projects: CreateProjectInput[];
      facts: CreateFactInput[];
      relations: CreateRelationInput[];
    },
    mode: 'replace' | 'merge' = 'replace'
  ): void {
    this.transaction(() => {
      if (mode === 'replace') {
        // Clear existing data
        this.db.delete(relations).run();
        this.db.delete(facts).run();
        this.db.delete(projects).run();
      }
      
      // Import projects
      for (const project of data.projects) {
        if (mode === 'merge') {
          const existing = this.findProject(project.id!);
          if (existing) continue;
        }
        this.createProject(project);
      }
      
      // Import facts
      for (const fact of data.facts) {
        if (mode === 'merge') {
          const existing = this.findFact(fact.id!);
          if (existing) continue;
        }
        this.createFact(fact);
      }
      
      // Import relations
      for (const relation of data.relations) {
        if (mode === 'merge') {
          // Check if relation already exists
          const existing = this.db.select()
            .from(relations)
            .where(and(
              eq(relations.fromFactId, relation.fromFactId),
              eq(relations.toFactId, relation.toFactId),
              eq(relations.type, relation.type)
            ))
            .get();
          if (existing) continue;
        }
        this.createRelation(relation);
      }
    });
  }

  // Helper methods to convert between DB and domain types
  private dbProjectToProject(dbProject: DbProject): Project {
    return {
      id: dbProject.id,
      name: dbProject.name,
      path: dbProject.path,
      gitRemote: dbProject.gitRemote || undefined,
      isMonorepo: dbProject.isMonorepo,
      services: JSON.parse(dbProject.services),
      lastSeen: new Date(dbProject.lastSeen),
      createdAt: new Date(dbProject.createdAt),
    };
  }

  private dbFactToFact(dbFact: DbFact): Fact {
    return {
      id: dbFact.id,
      projectId: dbFact.projectId,
      content: dbFact.content,
      why: dbFact.why || undefined,
      type: dbFact.type as FactType,
      services: JSON.parse(dbFact.services),
      tags: JSON.parse(dbFact.tags),
      confidence: dbFact.confidence,
      source: JSON.parse(dbFact.source),
      status: dbFact.status as FactStatus,
      createdAt: new Date(dbFact.createdAt),
      updatedAt: new Date(dbFact.updatedAt),
    };
  }

  private dbRelationToRelation(dbRelation: DbRelation): Relation {
    return {
      fromFactId: dbRelation.fromFactId,
      toFactId: dbRelation.toFactId,
      type: dbRelation.type as any,
      strength: dbRelation.strength,
      metadata: dbRelation.metadata ? JSON.parse(dbRelation.metadata) : undefined,
      createdAt: new Date(dbRelation.createdAt),
    };
  }
}