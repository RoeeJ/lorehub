import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, and, like, or, sql, desc } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import BetterSqlite3 from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from '../utils/uuid.js';
import { 
  realms, 
  lores, 
  loreRelations, 
  workspaces,
  realmWorkspaces,
  syncState,
  type Realm as DbRealm, 
  type Lore as DbLore, 
  type LoreRelation as DbLoreRelation,
  type Workspace as DbWorkspace,
  type RealmWorkspace as DbRealmWorkspace,
  type SyncState as DbSyncState
} from './schema.js';
import type { 
  Lore,
  LoreType,
  LoreStatus,
  CreateLoreInput,
  UpdateLoreInput,
  Realm,
  CreateRealmInput,
  CreateRelationInput,
  Relation,
  LoreRelation,
  RelationType,
  Workspace,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  SyncState
} from '../core/types.js';
import * as sqliteVec from 'sqlite-vec';
import { EmbeddingService } from '../core/embeddings.js';
import { getSearchCache } from '../core/search-cache.js';
import { ChangeTracker } from '../sync/change-tracker.js';

// Raw SQL result type (snake_case fields)
interface RawLoreRow {
  id: string;
  realm_id: string;
  content: string;
  why: string | null;
  type: string;
  provinces: string;
  sigils: string;
  confidence: number;
  origin: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export class Database {
  sqlite: BetterSqlite3.Database;  // Made public for migrate-embeddings command
  private db: ReturnType<typeof drizzle>;
  private embeddingService: EmbeddingService;
  private changeTracker: ChangeTracker;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dbDir = dirname(dbPath);
    if (dbDir && !existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    
    this.sqlite = new BetterSqlite3(dbPath);
    
    // Load sqlite-vec extension
    this.loadSqliteVec();
    
    // Configure SQLite for better performance
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('synchronous = NORMAL');
    this.sqlite.pragma('foreign_keys = ON');
    
    this.db = drizzle(this.sqlite);
    
    // Initialize embedding service
    this.embeddingService = EmbeddingService.getInstance();
    
    // Initialize change tracker
    this.changeTracker = ChangeTracker.getInstance();
    this.changeTracker.initialize(this);
    
    // Run Drizzle migrations
    this.runMigrations();
  }
  
  private loadSqliteVec(): void {
    try {
      // Load sqlite-vec extension
      sqliteVec.load(this.sqlite);
    } catch (error) {
      console.error('Failed to load sqlite-vec extension:', error);
      // Continue without vector support - graceful degradation
    }
  }

  private runMigrations(): void {
    try {
      // Get the directory where this file is located
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      
      // Try different locations for migrations
      let migrationsFolder = join(__dirname, '..', 'drizzle'); // dist/drizzle
      if (!existsSync(migrationsFolder)) {
        migrationsFolder = join(__dirname, '..', '..', '..', 'drizzle'); // realm root drizzle
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

  // Realm methods (was Realm)
  createRealm(input: CreateRealmInput): Realm {
    const id = input.id || uuidv4();
    const now = new Date();
    
    const realm = {
      id,
      name: input.name,
      path: input.path,
      gitRemote: input.gitRemote || null,
      isMonorepo: input.isMonorepo || false,
      provinces: JSON.stringify(input.provinces || []),
      lastSeen: (input.lastSeen || now).toISOString(),
      createdAt: (input.createdAt || now).toISOString(),
    };

    this.db.insert(realms).values(realm).run();
    
    return this.findRealm(id)!;
  }
  

  findRealm(id: string): Realm | null {
    const result = this.db.select().from(realms).where(eq(realms.id, id)).get();
    return result ? this.dbRealmToRealm(result) : null;
  }
  

  findRealmByPath(path: string): Realm | null {
    const result = this.db.select().from(realms).where(eq(realms.path, path)).get();
    return result ? this.dbRealmToRealm(result) : null;
  }
  

  updateRealmLastSeen(id: string): Realm | null {
    this.db.update(realms)
      .set({ lastSeen: new Date().toISOString() })
      .where(eq(realms.id, id))
      .run();
    
    return this.findRealm(id);
  }
  

  listRealms(): Realm[] {
    const results = this.db.select().from(realms).orderBy(desc(realms.lastSeen)).all();
    return results.map(r => this.dbRealmToRealm(r));
  }

  getCurrentRealm(): Realm | null {
    return this.findRealmByPath(process.cwd());
  }
  

  // Lore methods (was Lore)
  async createLore(input: CreateLoreInput): Promise<Lore> {
    const id = input.id || uuidv4();
    const now = new Date();
    
    const lore = {
      id,
      realmId: input.realmId,
      content: input.content,
      why: input.why || null,
      type: input.type,
      provinces: JSON.stringify(input.provinces || []),
      sigils: JSON.stringify(input.sigils || []),
      confidence: input.confidence || 80,
      origin: JSON.stringify(input.origin),
      status: input.status || 'living',
      createdAt: (input.createdAt || now).toISOString(),
      updatedAt: (input.updatedAt || now).toISOString(),
    };

    this.db.insert(lores).values(lore).run();
    
    // Generate embedding for the new lore
    try {
      await this.generateLoreEmbedding(id);
    } catch (error) {
      console.error(`Failed to generate embedding for new lore ${id}:`, error);
      // Don't fail lore creation if embedding generation fails
    }
    
    const createdLore = this.findLore(id)!;
    
    // Track the change
    await this.changeTracker.recordLoreChange('create', id, input.realmId, createdLore);
    
    return createdLore;
  }

  findLore(id: string): Lore | null {
    const result = this.db.select().from(lores).where(eq(lores.id, id)).get();
    return result ? this.dbLoreToLore(result) : null;
  }

  async updateLore(id: string, input: UpdateLoreInput): Promise<Lore | null> {
    const existingLore = this.findLore(id);
    if (!existingLore) return null;
    
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (input.content !== undefined) updates.content = input.content;
    if (input.why !== undefined) updates.why = input.why;
    if (input.type !== undefined) updates.type = input.type;
    if (input.provinces !== undefined) updates.provinces = JSON.stringify(input.provinces);
    if (input.sigils !== undefined) updates.sigils = JSON.stringify(input.sigils);
    if (input.confidence !== undefined) updates.confidence = input.confidence;
    if (input.origin !== undefined) updates.origin = JSON.stringify(input.origin);
    if (input.status !== undefined) updates.status = input.status;

    this.db.update(lores).set(updates).where(eq(lores.id, id)).run();
    
    const updatedLore = this.findLore(id);
    
    // Track the change
    if (updatedLore) {
      await this.changeTracker.recordLoreChange('update', id, existingLore.realmId, updatedLore);
    }
    
    return updatedLore;
  }

  async deleteLore(id: string): Promise<void> {
    const lore = this.findLore(id);
    if (!lore) return;
    
    this.db.delete(lores).where(eq(lores.id, id)).run();
    
    // Track the change
    await this.changeTracker.recordLoreChange('delete', id, lore.realmId, { id });
  }

  async softDeleteLore(id: string): Promise<void> {
    const lore = this.findLore(id);
    if (!lore) return;
    
    this.db.update(lores)
      .set({ 
        status: 'archived',
        updatedAt: new Date().toISOString()
      })
      .where(eq(lores.id, id))
      .run();
      
    // Track the change
    await this.changeTracker.recordLoreChange('archive', id, lore.realmId, { id, status: 'archived' });
  }

  restoreLore(id: string): void {
    this.db.update(lores)
      .set({ 
        status: 'active',
        updatedAt: new Date().toISOString()
      })
      .where(eq(lores.id, id))
      .run();
  }

  listLoresByRealm(realmId: string): Lore[] {
    const results = this.db.select()
      .from(lores)
      .where(eq(lores.realmId, realmId))
      .orderBy(desc(lores.createdAt))
      .all();
    
    return results.map(l => this.dbLoreToLore(l));
  }

  listLoresByType(realmId: string, type: LoreType): Lore[] {
    // Convert old type names to new ones if needed
    let queryType = type as string;
    if (queryType === 'decision') queryType = 'decree';
    else if (queryType === 'learning') queryType = 'lesson';
    else if (queryType === 'todo') queryType = 'quest';
    
    const results = this.db.select()
      .from(lores)
      .where(and(eq(lores.realmId, realmId), eq(lores.type, queryType)))
      .orderBy(desc(lores.createdAt))
      .all();
    
    return results.map(l => this.dbLoreToLore(l));
  }

  listLoresByProvince(realmId: string, province: string): Lore[] {
    // Use SQL LIKE with JSON array search pattern
    const results = this.db.select()
      .from(lores)
      .where(and(
        eq(lores.realmId, realmId),
        like(lores.provinces, `%"${province}"%`)
      ))
      .orderBy(desc(lores.createdAt))
      .all();
    
    return results.map(l => this.dbLoreToLore(l));
  }

  searchLores(realmId: string, query: string, limit?: number): Lore[] {
    // Convert wildcards to SQL patterns
    const pattern = `%${query.replace(/\*/g, '%').replace(/\?/g, '_')}%`;
    
    const baseQuery = this.db.select()
      .from(lores)
      .where(and(
        eq(lores.realmId, realmId),
        or(
          like(lores.content, pattern),
          like(lores.sigils, pattern)
        )
      ))
      .orderBy(desc(lores.createdAt));
    
    const results = limit ? baseQuery.limit(limit).all() : baseQuery.all();
    return results.map(l => this.dbLoreToLore(l));
  }

  searchLoresGlobal(query: string, limit?: number): Lore[] {
    // Convert wildcards to SQL patterns
    const pattern = `%${query.replace(/\*/g, '%').replace(/\?/g, '_')}%`;
    
    const baseQuery = this.db.select()
      .from(lores)
      .where(or(
        like(lores.content, pattern),
        like(lores.sigils, pattern)
      ))
      .orderBy(desc(lores.createdAt));
    
    const results = limit ? baseQuery.limit(limit).all() : baseQuery.all();
    return results.map(l => this.dbLoreToLore(l));
  }

  getRealmLoreCount(realmId: string): number {
    const result = this.db.select({ count: sql<number>`count(*)` })
      .from(lores)
      .where(eq(lores.realmId, realmId))
      .get();
    
    return result?.count || 0;
  }

  // Vector/Semantic Search methods
  async semanticSearchLores(
    query: string,
    options: {
      realmId?: string;
      threshold?: number;
      limit?: number;
      includeScore?: boolean;
    } = {}
  ): Promise<(Lore & { similarity?: number })[]> {
    try {
      const cache = getSearchCache();
      
      // Check cache for results
      const cachedResults = cache.getResults(query, options);
      if (cachedResults) {
        return cachedResults;
      }
      
      // Check cache for embedding
      let queryEmbedding = cache.getEmbedding(query);
      if (!queryEmbedding) {
        // Generate embedding for query
        queryEmbedding = await this.embeddingService.generateEmbedding(query);
        cache.setEmbedding(query, queryEmbedding);
      }
      
      // Build the query based on options
      let sqlQuery = `
        SELECT l.*, vec_distance_l2(v.embedding, ?) as distance
        FROM lores l
        JOIN lores_vec v ON l.id = v.lore_id
        WHERE 1=1
      `;
      
      const params: any[] = [queryEmbedding];
      
      if (options.realmId) {
        sqlQuery += ` AND l.realm_id = ?`;
        params.push(options.realmId);
      }
      
      // Add threshold filter if specified
      if (options.threshold !== undefined) {
        sqlQuery += ` AND vec_distance_l2(v.embedding, ?) < ?`;
        params.push(queryEmbedding, options.threshold);
      }
      
      sqlQuery += ` ORDER BY distance ASC`;
      
      if (options.limit) {
        sqlQuery += ` LIMIT ?`;
        params.push(options.limit);
      }
      
      const results = this.sqlite.prepare(sqlQuery).all(...params) as (RawLoreRow & { distance: number })[];
      
      const mappedResults = results.map(row => {
        const lore = this.dbLoreToLore(row);
        if (options.includeScore) {
          // Convert distance to similarity score (0-1, where 1 is most similar)
          // Using a simple inverse distance formula
          const similarity = 1 / (1 + row.distance);
          return { ...lore, similarity };
        }
        return lore;
      });
      
      // Cache the results
      cache.setResults(query, options, mappedResults);
      
      return mappedResults;
    } catch (error) {
      console.error('Semantic search failed:', error);
      // Fallback to regular search
      return this.searchLores(options.realmId || '', query, options.limit);
    }
  }

  async findSimilarLores(
    loreId: string,
    options: { limit?: number; threshold?: number } = {}
  ): Promise<(Lore & { similarity: number })[]> {
    const lore = this.findLore(loreId);
    if (!lore) return [];
    
    // Format lore for embedding
    const loreText = this.embeddingService.formatLoreForEmbedding({
      content: lore.content,
      why: lore.why,
      sigils: lore.sigils,
      type: lore.type
    });
    
    // Search for similar lores, excluding the original
    const results = await this.semanticSearchLores(loreText, {
      realmId: lore.realmId,
      limit: (options.limit || 10) + 1, // Get one extra to exclude self
      includeScore: true
    });
    
    // Filter out the original lore and apply threshold
    const threshold = options.threshold || 0;
    return results
      .filter(l => l.id !== loreId && l.similarity !== undefined && l.similarity >= threshold)
      .slice(0, options.limit || 10) as (Lore & { similarity: number })[];
  }

  async generateLoreEmbedding(loreId: string): Promise<void> {
    const lore = this.findLore(loreId);
    if (!lore) {
      throw new Error(`Lore ${loreId} not found`);
    }
    
    // Format lore for embedding
    const loreText = this.embeddingService.formatLoreForEmbedding({
      content: lore.content,
      why: lore.why,
      sigils: lore.sigils,
      type: lore.type
    });
    
    // Generate embedding
    const embedding = await this.embeddingService.generateEmbedding(loreText);
    
    // Store embedding
    try {
      // First try to delete existing embedding (for virtual tables, REPLACE might not work)
      this.sqlite.prepare(`DELETE FROM lores_vec WHERE lore_id = ?`).run(loreId);
      
      // Then insert the new embedding
      this.sqlite.prepare(`
        INSERT INTO lores_vec (lore_id, embedding)
        VALUES (?, ?)
      `).run(loreId, embedding);
      
      // Note: We no longer track embedding_generated in the lores table
      // The presence of a record in lores_vec indicates an embedding exists
    } catch (error) {
      console.error(`Failed to store embedding for lore ${loreId}:`, error);
      throw error;
    }
  }

  recreateLoresVecTable(dimensions: number): void {
    try {
      // Drop the existing table
      this.sqlite.exec('DROP TABLE IF EXISTS lores_vec');
      
      // Recreate with new dimensions
      this.sqlite.exec(`
        CREATE VIRTUAL TABLE lores_vec USING vec0(
          lore_id text PRIMARY KEY,
          embedding float[${dimensions}]
        )
      `);
      
      console.log(`✓ Recreated lores_vec table with ${dimensions} dimensions`);
    } catch (error) {
      console.error('Failed to recreate lores_vec table:', error);
      throw error;
    }
  }
  
  async generateMissingEmbeddings(realmId?: string, batchSize: number = 50, force: boolean = false): Promise<number> {
    let query: string;
    
    if (force) {
      // When force is true, get all lores regardless of existing embeddings
      query = `SELECT l.* FROM lores l WHERE 1=1`;
    } else {
      // Only get lores without embeddings
      query = `
        SELECT l.* FROM lores l
        LEFT JOIN lores_vec v ON l.id = v.lore_id
        WHERE v.lore_id IS NULL
      `;
    }
    
    const params: any[] = [];
    if (realmId) {
      query += ` AND l.realm_id = ?`;
      params.push(realmId);
    }
    
    query += ` LIMIT ?`;
    params.push(batchSize);
    
    const loresToEmbed = this.sqlite.prepare(query).all(...params) as DbLore[];
    
    let count = 0;
    for (const dbLore of loresToEmbed) {
      try {
        await this.generateLoreEmbedding(dbLore.id);
        count++;
      } catch (error) {
        console.error(`Failed to generate embedding for lore ${dbLore.id}:`, error);
      }
    }
    
    return count;
  }

  // Check if a lore might be a duplicate
  async checkForDuplicates(
    content: string,
    realmId: string,
    threshold: number = 0.85
  ): Promise<(Lore & { similarity: number })[]> {
    const results = await this.semanticSearchLores(content, {
      realmId,
      threshold: 1 - threshold, // Convert similarity to distance threshold
      limit: 5,
      includeScore: true
    });
    
    return results.filter(l => l.similarity !== undefined && l.similarity >= threshold) as (Lore & { similarity: number })[];
  }

  // Relation methods
  async createRelation(input: CreateRelationInput): Promise<Relation> {
    const relation = {
      fromLoreId: input.fromLoreId,
      toLoreId: input.toLoreId,
      type: input.type,
      strength: input.strength || 1.0,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: (input.createdAt || new Date()).toISOString(),
    };

    this.db.insert(loreRelations).values(relation).run();
    
    // Get realm from the fromLore
    const fromLore = this.findLore(input.fromLoreId);
    if (fromLore) {
      await this.changeTracker.recordRelationChange(
        'create',
        input.fromLoreId,
        input.toLoreId,
        input.type,
        fromLore.realmId,
        relation
      );
    }
    
    return this.dbRelationToRelation(relation as DbLoreRelation);
  }

  listRelationsByLore(loreId: string): LoreRelation[] {
    const results = this.db.select()
      .from(loreRelations)
      .where(or(
        eq(loreRelations.fromLoreId, loreId),
        eq(loreRelations.toLoreId, loreId)
      ))
      .all();
    
    return results.map(r => this.dbRelationToRelation(r));
  }

  async deleteRelation(fromLoreId: string, toLoreId: string, type: string): Promise<void> {
    // Get realm from the fromLore
    const fromLore = this.findLore(fromLoreId);
    
    this.db.delete(loreRelations)
      .where(and(
        eq(loreRelations.fromLoreId, fromLoreId),
        eq(loreRelations.toLoreId, toLoreId),
        eq(loreRelations.type, type)
      ))
      .run();
      
    if (fromLore) {
      await this.changeTracker.recordRelationChange(
        'delete',
        fromLoreId,
        toLoreId,
        type,
        fromLore.realmId
      );
    }
  }

  // Export/Import methods
  exportData(realmId?: string): {
    realms: Realm[];
    lores: Lore[];
    relations: Relation[];
  } {
    if (realmId) {
      const realm = this.findRealm(realmId);
      if (!realm) {
        throw new Error(`Realm ${realmId} not found`);
      }
      
      const realmLores = this.listLoresByRealm(realmId);
      const loreIds = new Set(realmLores.map(l => l.id));
      
      const relevantRelations = this.db.select()
        .from(loreRelations)
        .all()
        .filter(r => loreIds.has(r.fromLoreId) || loreIds.has(r.toLoreId))
        .map(r => this.dbRelationToRelation(r));
      
      return {
        realms: [realm],
        lores: realmLores,
        relations: relevantRelations,
      };
    }
    
    return {
      realms: this.listRealms(),
      lores: this.searchLoresGlobal('*'),
      relations: this.db.select().from(loreRelations).all().map(r => this.dbRelationToRelation(r)),
    };
  }

  async importData(
    data: {
      realms: CreateRealmInput[];
      lores: CreateLoreInput[];
      relations: CreateRelationInput[];
    },
    mode: 'replace' | 'merge' = 'replace'
  ): Promise<void> {
    // Disable change tracking during import
    this.changeTracker.disable();
    
    try {
      if (mode === 'replace') {
        // Clear existing data
        this.db.delete(loreRelations).run();
        this.db.delete(lores).run();
        this.db.delete(realms).run();
      }
      
      // Import realms
      for (const realm of data.realms) {
        if (mode === 'merge') {
          const existing = this.findRealm(realm.id!);
          if (existing) continue;
        }
        this.createRealm(realm);
      }
      
      // Import lores
      for (const lore of data.lores) {
        if (mode === 'merge') {
          const existing = this.findLore(lore.id!);
          if (existing) continue;
        }
        await this.createLore(lore);
      }
      
      // Import relations
      for (const relation of data.relations) {
        if (mode === 'merge') {
          // Check if relation already exists
          const existing = this.db.select()
            .from(loreRelations)
            .where(and(
              eq(loreRelations.fromLoreId, relation.fromLoreId),
              eq(loreRelations.toLoreId, relation.toLoreId),
              eq(loreRelations.type, relation.type)
            ))
            .get();
          if (existing) continue;
        }
        await this.createRelation(relation);
      }
    } finally {
      // Re-enable change tracking
      this.changeTracker.enable();
    }
  }

  // Helper methods to convert between DB and domain types
  private dbRealmToRealm(dbRealm: DbRealm): Realm {
    return {
      id: dbRealm.id,
      name: dbRealm.name,
      path: dbRealm.path,
      gitRemote: dbRealm.gitRemote || undefined,
      isMonorepo: dbRealm.isMonorepo,
      provinces: JSON.parse(dbRealm.provinces),
      lastSeen: new Date(dbRealm.lastSeen),
      createdAt: new Date(dbRealm.createdAt),
    };
  }

  private dbLoreToLore(dbLore: DbLore | RawLoreRow): Lore {
    // Check if it's a raw SQL result (has snake_case fields)
    const isRawRow = 'realm_id' in dbLore;
    
    return {
      id: dbLore.id,
      realmId: isRawRow ? (dbLore as RawLoreRow).realm_id : (dbLore as DbLore).realmId,
      content: dbLore.content,
      why: dbLore.why || undefined,
      type: dbLore.type as LoreType,
      provinces: JSON.parse(dbLore.provinces),
      sigils: JSON.parse(dbLore.sigils),
      confidence: dbLore.confidence,
      origin: JSON.parse(dbLore.origin),
      status: dbLore.status as LoreStatus,
      createdAt: new Date(isRawRow ? (dbLore as RawLoreRow).created_at : (dbLore as DbLore).createdAt),
      updatedAt: new Date(isRawRow ? (dbLore as RawLoreRow).updated_at : (dbLore as DbLore).updatedAt),
    };
  }

  private dbRelationToRelation(dbRelation: DbLoreRelation): LoreRelation {
    return {
      fromLoreId: dbRelation.fromLoreId,
      toLoreId: dbRelation.toLoreId,
      type: dbRelation.type as RelationType,
      strength: dbRelation.strength,
      metadata: dbRelation.metadata ? JSON.parse(dbRelation.metadata) : undefined,
      createdAt: new Date(dbRelation.createdAt),
    };
  }

  // Workspace methods
  createWorkspace(input: CreateWorkspaceInput): Workspace {
    const id = input.id || uuidv4();
    const now = new Date();
    
    // Check if name already exists
    const existing = this.db.select().from(workspaces)
      .where(eq(workspaces.name, input.name))
      .get();
    
    if (existing) {
      throw new Error(`Workspace with name '${input.name}' already exists`);
    }
    
    // If this is the first workspace or isDefault is true, set it as default
    const workspaceCount = this.db.select({ count: sql<number>`count(*)` })
      .from(workspaces)
      .get()?.count || 0;
    
    const shouldBeDefault = input.isDefault || workspaceCount === 0;
    
    // If setting as default, unset any existing default
    if (shouldBeDefault) {
      this.db.update(workspaces)
        .set({ isDefault: false })
        .where(eq(workspaces.isDefault, true))
        .run();
    }
    
    const workspace = {
      id,
      name: input.name,
      syncEnabled: input.syncEnabled || false,
      syncRepo: input.syncRepo || null,
      syncBranch: input.syncBranch || 'main',
      autoSync: input.autoSync ?? true,
      syncInterval: input.syncInterval || 300,
      filters: input.filters ? JSON.stringify(input.filters) : null,
      isDefault: shouldBeDefault,
      createdAt: (input.createdAt || now).toISOString(),
      updatedAt: (input.updatedAt || now).toISOString(),
    };

    this.db.insert(workspaces).values(workspace).run();
    
    return this.findWorkspace(id)!;
  }

  findWorkspace(id: string): Workspace | null {
    const result = this.db.select().from(workspaces).where(eq(workspaces.id, id)).get();
    return result ? this.dbWorkspaceToWorkspace(result) : null;
  }

  findWorkspaceByName(name: string): Workspace | null {
    const result = this.db.select().from(workspaces).where(eq(workspaces.name, name)).get();
    return result ? this.dbWorkspaceToWorkspace(result) : null;
  }

  getDefaultWorkspace(): Workspace | null {
    const result = this.db.select().from(workspaces).where(eq(workspaces.isDefault, true)).get();
    return result ? this.dbWorkspaceToWorkspace(result) : null;
  }

  listWorkspaces(): Workspace[] {
    return this.db.select().from(workspaces)
      .orderBy(desc(workspaces.isDefault), workspaces.name)
      .all()
      .map(w => this.dbWorkspaceToWorkspace(w));
  }

  updateWorkspace(id: string, input: UpdateWorkspaceInput): Workspace | null {
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.syncEnabled !== undefined) updates.syncEnabled = input.syncEnabled;
    if (input.syncRepo !== undefined) updates.syncRepo = input.syncRepo;
    if (input.syncBranch !== undefined) updates.syncBranch = input.syncBranch;
    if (input.autoSync !== undefined) updates.autoSync = input.autoSync;
    if (input.syncInterval !== undefined) updates.syncInterval = input.syncInterval;
    if (input.filters !== undefined) updates.filters = JSON.stringify(input.filters);
    if (input.isDefault !== undefined) {
      updates.isDefault = input.isDefault;
      // If setting as default, unset any existing default
      if (input.isDefault) {
        this.db.update(workspaces)
          .set({ isDefault: false })
          .where(and(eq(workspaces.isDefault, true), sql`id != ${id}`))
          .run();
      }
    }

    this.db.update(workspaces).set(updates).where(eq(workspaces.id, id)).run();
    
    return this.findWorkspace(id);
  }

  deleteWorkspace(id: string): void {
    // Check if it's the default workspace
    const workspace = this.findWorkspace(id);
    if (!workspace) {
      throw new Error(`Workspace ${id} not found`);
    }
    
    if (workspace.isDefault) {
      // Set another workspace as default if exists
      const otherWorkspace = this.db.select().from(workspaces)
        .where(sql`id != ${id}`)
        .get();
      
      if (otherWorkspace) {
        this.db.update(workspaces)
          .set({ isDefault: true })
          .where(eq(workspaces.id, otherWorkspace.id))
          .run();
      }
    }
    
    this.db.delete(workspaces).where(eq(workspaces.id, id)).run();
  }

  // Realm-Workspace associations
  linkRealmToWorkspace(realmId: string, workspaceId: string): void {
    // Verify both exist
    if (!this.findRealm(realmId)) {
      throw new Error(`Realm ${realmId} not found`);
    }
    if (!this.findWorkspace(workspaceId)) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }
    
    // Check if already linked
    const existing = this.db.select().from(realmWorkspaces)
      .where(and(
        eq(realmWorkspaces.realmId, realmId),
        eq(realmWorkspaces.workspaceId, workspaceId)
      ))
      .get();
    
    if (existing) {
      return; // Already linked
    }
    
    this.db.insert(realmWorkspaces).values({
      realmId,
      workspaceId,
      createdAt: new Date().toISOString(),
    }).run();
  }

  unlinkRealmFromWorkspace(realmId: string, workspaceId: string): void {
    this.db.delete(realmWorkspaces)
      .where(and(
        eq(realmWorkspaces.realmId, realmId),
        eq(realmWorkspaces.workspaceId, workspaceId)
      ))
      .run();
  }

  getRealmWorkspaces(realmId: string): Workspace[] {
    const results = this.db.select({ workspace: workspaces })
      .from(realmWorkspaces)
      .innerJoin(workspaces, eq(realmWorkspaces.workspaceId, workspaces.id))
      .where(eq(realmWorkspaces.realmId, realmId))
      .all();
    
    return results.map(r => this.dbWorkspaceToWorkspace(r.workspace));
  }

  getWorkspaceRealms(workspaceId: string): Realm[] {
    const results = this.db.select({ realm: realms })
      .from(realmWorkspaces)
      .innerJoin(realms, eq(realmWorkspaces.realmId, realms.id))
      .where(eq(realmWorkspaces.workspaceId, workspaceId))
      .all();
    
    return results.map(r => this.dbRealmToRealm(r.realm));
  }

  // Helper method to get or create default workspace
  ensureDefaultWorkspace(): Workspace {
    let defaultWorkspace = this.getDefaultWorkspace();
    
    if (!defaultWorkspace) {
      // Create a default workspace
      defaultWorkspace = this.createWorkspace({
        name: 'main',
        isDefault: true,
        syncEnabled: false,
      });
    }
    
    return defaultWorkspace;
  }

  private dbWorkspaceToWorkspace(dbWorkspace: DbWorkspace): Workspace {
    return {
      id: dbWorkspace.id,
      name: dbWorkspace.name,
      syncEnabled: dbWorkspace.syncEnabled,
      syncRepo: dbWorkspace.syncRepo || undefined,
      syncBranch: dbWorkspace.syncBranch || 'main',
      autoSync: dbWorkspace.autoSync,
      syncInterval: dbWorkspace.syncInterval || 300,
      filters: dbWorkspace.filters ? JSON.parse(dbWorkspace.filters) : undefined,
      isDefault: dbWorkspace.isDefault,
      createdAt: new Date(dbWorkspace.createdAt),
      updatedAt: new Date(dbWorkspace.updatedAt),
    };
  }
}