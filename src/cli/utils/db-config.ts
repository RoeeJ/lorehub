import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export function getDbPath(): string {
  const configDir = join(homedir(), '.lorehub');
  
  // Ensure config directory exists
  mkdirSync(configDir, { recursive: true });
  
  return join(configDir, 'lorehub.db');
}