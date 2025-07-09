import { defineConfig } from 'drizzle-kit';
import { homedir } from 'os';
import { join } from 'path';

// Duplicate the logic from db-config.ts since we can't import at config time
const dbPath = process.env.LOREHUB_DB_PATH || join(homedir(), '.lorehub', 'lorehub.db');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath,
  },
  verbose: true,
  strict: true,
});