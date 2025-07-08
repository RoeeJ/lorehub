import React from 'react';
import { render } from 'ink';
import { Database } from '../../db/database.js';
import { ListFacts } from '../components/ListFacts.js';
import { getDbPath } from '../utils/db-config.js';

interface ListOptions {
  type?: string;
  service?: string;
  limit?: number;
  projectPath?: string;
  currentProjectOnly?: boolean;
}

export async function renderList(options: ListOptions): Promise<void> {
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  
  // Check if we can use interactive mode
  if (!process.stdin.isTTY) {
    // Non-interactive fallback
    try {
      const project = db.findProjectByPath(process.cwd());
      
      let facts: any[] = [];
      const projects = db.listProjects();
      const currentProject = project;
      
      // Filter projects based on options
      let projectsToList = projects;
      
      if (options.currentProjectOnly) {
        if (!currentProject) {
          console.log('No LoreHub project found in current directory.');
          return;
        }
        projectsToList = [currentProject];
      } else if (options.projectPath) {
        const specificProject = db.findProjectByPath(options.projectPath);
        if (!specificProject) {
          console.log(`No LoreHub project found at path: ${options.projectPath}`);
          return;
        }
        projectsToList = [specificProject];
      }
      
      // List facts from selected projects
      for (const proj of projectsToList) {
        let projectFacts: any[] = [];
        
        if (options.type) {
          projectFacts = db.listFactsByType(proj.id, options.type as any);
        } else if (options.service) {
          projectFacts = db.listFactsByService(proj.id, options.service);
        } else {
          projectFacts = db.listFactsByProject(proj.id);
        }
        
        // Add project info to each fact
        facts.push(...projectFacts.map(f => ({
          ...f,
          projectName: proj.name,
          projectPath: proj.path,
          isCurrentProject: currentProject?.id === proj.id
        })));
      }

      // Sort by current project first, then by creation date descending
      facts.sort((a, b) => {
        // Prioritize current project
        if (a.isCurrentProject && !b.isCurrentProject) return -1;
        if (!a.isCurrentProject && b.isCurrentProject) return 1;
        // Then by date
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      
      // Apply limit
      if (facts.length > (options.limit || 20)) {
        facts = facts.slice(0, options.limit || 20);
      }

      if (facts.length === 0) {
        console.log('No facts found.');
        if (options.type) console.log(`Filter: type = ${options.type}`);
        if (options.service) console.log(`Filter: service = ${options.service}`);
      } else {
        console.log(`\nFacts (${facts.length}):\n`);
        facts.forEach((fact, index) => {
          const projectIndicator = fact.isCurrentProject ? ' ⭐' : '';
          console.log(`${index + 1}. [${fact.type}] ${fact.content}`);
          console.log(`   Project: ${fact.projectName}${projectIndicator} (${fact.projectPath})`);
          if (fact.why) {
            console.log(`   Why: ${fact.why}`);
          }
          console.log(`   Created: ${fact.createdAt.toLocaleString()}`);
          if (fact.tags.length > 0) {
            console.log(`   Tags: ${fact.tags.join(', ')}`);
          }
          console.log('');
        });
      }
    } finally {
      db.close();
    }
    return;
  }
  
  // Interactive mode with Ink
  const { waitUntilExit } = render(
    <ListFacts
      db={db}
      projectPath={process.cwd()}
      type={options.type}
      service={options.service}
      limit={options.limit || 20}
      filterProjectPath={options.projectPath}
      currentProjectOnly={options.currentProjectOnly}
    />
  );

  try {
    await waitUntilExit();
  } finally {
    db.close();
  }
}