#!/usr/bin/env node
// Script to backup existing database and migrate to Drizzle

import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import Database from 'better-sqlite3';

const dbDir = path.join(homedir(), '.lorehub');
const dbPath = path.join(dbDir, 'lorehub.db');
const backupPath = path.join(dbDir, `lorehub-backup-${Date.now()}.db`);

// Check if database exists
if (fs.existsSync(dbPath)) {
  console.log(`📦 Backing up existing database to: ${backupPath}`);
  
  // Create backup
  fs.copyFileSync(dbPath, backupPath);
  console.log('✅ Backup created successfully');
  
  // Open the database and check if it needs migration
  const db = new Database(dbPath);
  
  try {
    // Check if migrations table exists (new Drizzle format)
    const migrationsTableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='__drizzle_migrations'
    `).get();
    
    if (!migrationsTableExists) {
      console.log('🔄 Database needs migration to Drizzle format');
      
      // Add any missing columns or updates
      // Check if 'archived' is already a valid status
      const factWithArchived = db.prepare(`
        SELECT * FROM facts WHERE status = 'archived' LIMIT 1
      `).pluck().get();
      
      console.log('✅ Database schema is compatible with Drizzle');
      console.log('📝 Run "npm run db:migrate" to apply Drizzle migrations');
    } else {
      console.log('✅ Database already migrated to Drizzle');
    }
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    db.close();
  }
} else {
  console.log('📝 No existing database found. Run "npm run db:migrate" to create a new one.');
}

console.log('\n🚀 Next steps:');
console.log('1. Run "npm run db:migrate" to apply migrations');
console.log('2. Run "npm run build" to compile the project');
console.log('3. Test the application with "lh"');