#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Ensure dist directory exists
const distDir = join(projectRoot, 'dist');
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Copy drizzle migrations to dist
const drizzleSource = join(projectRoot, 'drizzle');
const drizzleDest = join(projectRoot, 'dist', 'drizzle');

if (existsSync(drizzleSource)) {
  console.log('Copying drizzle migrations to dist...');
  cpSync(drizzleSource, drizzleDest, { recursive: true });
  console.log('✓ Drizzle migrations copied');
} else {
  console.warn('⚠ No drizzle migrations found');
}

// Make bin files executable
const binFiles = [
  join(projectRoot, 'dist', 'index.js'),
  join(projectRoot, 'dist', 'mcp', 'index.js')
];

console.log('Setting executable permissions on bin files...');
binFiles.forEach(file => {
  if (existsSync(file)) {
    chmodSync(file, 0o755);
    console.log(`✓ Made ${file} executable`);
  } else {
    console.warn(`⚠ Bin file not found: ${file}`);
  }
});