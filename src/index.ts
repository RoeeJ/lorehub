#!/usr/bin/env node
import { run } from './cli/cli.js';

run().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});