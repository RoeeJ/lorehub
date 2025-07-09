import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { getDbPath } from '../cli/utils/db-config.js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

async function runMigrations() {
  const sqlite = new Database(getDbPath());
  const db = drizzle(sqlite);

  // Check if this is an existing database
  const existingTables = sqlite.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name IN ('projects', 'facts', 'relations')
  `).all();

  if (existingTables.length > 0) {
    console.log('📦 Existing database detected');
    
    // Check if migrations table exists
    const migrationsTable = sqlite.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='__drizzle_migrations'
    `).get();
    
    if (!migrationsTable) {
      console.log('🔄 Creating migrations table for existing database...');
      
      // Create the migrations table
      sqlite.exec(`
        CREATE TABLE "__drizzle_migrations" (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hash text NOT NULL UNIQUE,
          created_at numeric
        )
      `);
      
      // Mark the initial migration as already applied
      const initialMigrationHash = createHash('sha256')
        .update(readFileSync('./drizzle/0000_dusty_carlie_cooper.sql', 'utf8'))
        .digest('hex');
      
      sqlite.prepare(`
        INSERT INTO __drizzle_migrations (hash, created_at) 
        VALUES (?, ?)
      `).run(initialMigrationHash, Date.now());
      
      console.log('✅ Marked initial migration as applied');
    }
  }

  // Run migrations
  try {
    migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations completed successfully');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('✅ Database schema is up to date');
    } else {
      throw error;
    }
  }

  sqlite.close();
}

runMigrations().catch(console.error);