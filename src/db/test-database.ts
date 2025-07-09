import { Database } from './database.js';
import { existsSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a test database with migrations available
export function createTestDatabase(dbPath: string = ':memory:'): Database {
  // For in-memory databases, we need to ensure migrations are available
  if (dbPath === ':memory:') {
    // Copy migrations to a temp location that the Database class can find
    const tempMigrationsDir = join(__dirname, '..', '..', '..', 'drizzle');
    
    // Ensure the drizzle folder exists in the test environment
    if (!existsSync(tempMigrationsDir)) {
      // Create a minimal migration structure for tests
      mkdirSync(tempMigrationsDir, { recursive: true });
      mkdirSync(join(tempMigrationsDir, 'meta'), { recursive: true });
      
      // Copy from the source drizzle folder if it exists
      const sourceDrizzle = join(__dirname, '..', '..', 'drizzle');
      if (existsSync(sourceDrizzle)) {
        cpSync(sourceDrizzle, tempMigrationsDir, { recursive: true });
      }
    }
  }
  
  return new Database(dbPath);
}