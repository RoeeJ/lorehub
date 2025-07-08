import React from 'react';
import { render } from 'ink';
import { Database } from '../../db/database.js';
import { AddFact } from '../components/AddFact.js';
import { getDbPath } from '../utils/db-config.js';
import { getProjectInfo } from '../utils/project.js';
import type { FactType } from '../../core/types.js';

interface AddOptions {
  initialContent?: string;
  type?: FactType;
  why?: string;
  services?: string[];
  tags?: string[];
  confidence?: number;
}

export async function renderAddFact(options: AddOptions): Promise<void> {
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  
  // If we have content and are not in a TTY, use non-interactive mode
  if (options.initialContent && !process.stdin.isTTY) {
    try {
      const projectInfo = await getProjectInfo(process.cwd());
      let project = db.findProjectByPath(process.cwd());
      
      if (!project) {
        project = db.createProject({
          name: projectInfo.name,
          path: projectInfo.path,
          gitRemote: projectInfo.gitRemote,
          isMonorepo: projectInfo.isMonorepo,
          services: projectInfo.services,
        });
      }
      
      const fact = db.createFact({
        projectId: project.id,
        content: options.initialContent,
        type: options.type || 'decision',
        why: options.why,
        services: options.services || [],
        tags: options.tags || [],
        confidence: options.confidence || 80,
        source: {
          type: 'manual',
          reference: 'cli',
          context: `Added via CLI in ${project.name}`,
        },
      });
      
      console.log('✓ Fact added successfully');
      console.log(`  ID: ${fact.id}`);
      console.log(`  Project: ${project.name}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    } finally {
      db.close();
    }
    return;
  }
  
  // Interactive mode with Ink
  const { waitUntilExit } = render(
    <AddFact
      db={db}
      projectPath={process.cwd()}
      initialContent={options.initialContent || ''}
      initialType={options.type}
      initialWhy={options.why}
      initialServices={options.services}
      initialTags={options.tags}
      initialConfidence={options.confidence}
      onComplete={(success) => {
        if (success && options.initialContent) {
          // For non-interactive mode, show a simple success message
          console.log('✓ Fact added successfully');
        }
      }}
    />
  );

  try {
    await waitUntilExit();
  } finally {
    db.close();
  }
}