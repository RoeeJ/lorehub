#!/usr/bin/env node
import { LoreHubServer } from './server.js';

async function main() {
  const server = new LoreHubServer();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.error('Shutting down LoreHub MCP server...');
    server.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.error('Shutting down LoreHub MCP server...');
    server.close();
    process.exit(0);
  });

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});