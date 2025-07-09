// Test setup to ensure migrations are available
import { existsSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure drizzle migrations are available in test environment
const sourceDrizzle = join(__dirname, '..', '..', 'drizzle');
const testDrizzle = join(__dirname, '..', '..', '..', 'drizzle');

if (!existsSync(testDrizzle) && existsSync(sourceDrizzle)) {
  console.log('Copying drizzle migrations for tests...');
  cpSync(sourceDrizzle, testDrizzle, { recursive: true });
}