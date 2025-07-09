import React from 'react';
import { render } from 'ink';
import { Database } from '../../db/database.js';
import { FactsView } from '../components/FactsView.js';
import { getDbPath } from '../utils/db-config.js';

interface SearchOptions {
  query: string;
  type?: string;
  service?: string;
  projectPath?: string;
  currentProjectOnly?: boolean;
  semantic?: boolean;
  threshold?: number;
}

export async function renderSearch(options: SearchOptions): Promise<void> {
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  
  // Check if we can use interactive mode
  if (!process.stdin.isTTY) {
    // Non-interactive fallback
    try {
      const project = db.findProjectByPath(process.cwd());
      
      let results: any[] = [];
      const projects = db.listProjects();
      const currentProject = project;
      
      // Filter projects based on options
      let projectsToSearch = projects;
      
      if (options.currentProjectOnly) {
        if (!currentProject) {
          console.log('No LoreHub project found in current directory.');
          return;
        }
        projectsToSearch = [currentProject];
      } else if (options.projectPath) {
        const specificProject = db.findProjectByPath(options.projectPath);
        if (!specificProject) {
          console.log(`No LoreHub project found at path: ${options.projectPath}`);
          return;
        }
        projectsToSearch = [specificProject];
      }
      
      // Search selected projects
      for (const proj of projectsToSearch) {
        let projectFacts: any[];
        
        if (options.semantic) {
          // Use semantic search
          // Note: semanticSearchFacts expects distance threshold, not similarity
          // Don't pass threshold to get all results, we'll filter by similarity later
          projectFacts = await db.semanticSearchFacts(options.query, {
            projectId: proj.id,
            includeScore: true
          });
        } else {
          // Use traditional keyword search
          projectFacts = db.searchFacts(proj.id, options.query);
        }
        
        // Add project info to each fact for display
        results.push(...projectFacts.map(f => ({ 
          ...f, 
          projectName: proj.name,
          projectPath: proj.path,
          isCurrentProject: currentProject?.id === proj.id 
        })));
      }

      // Apply filters
      if (options.type) {
        results = results.filter(f => f.type === options.type);
      }
      
      if (options.service) {
        results = results.filter(f => f.services.includes(options.service));
      }
      
      // Apply similarity threshold filter for semantic search
      if (options.semantic && options.threshold !== undefined) {
        const threshold = options.threshold;
        results = results.filter(f => f.similarity !== undefined && f.similarity >= threshold);
      }

      // Sort by current project first, then by creation date descending
      results.sort((a, b) => {
        // Prioritize current project
        if (a.isCurrentProject && !b.isCurrentProject) return -1;
        if (!a.isCurrentProject && b.isCurrentProject) return 1;
        // Then by date
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      if (results.length === 0) {
        console.log(`No facts found matching "${options.query}"`);
        if (options.type) console.log(`Filter: type = ${options.type}`);
        if (options.service) console.log(`Filter: service = ${options.service}`);
      } else {
        const searchMode = options.semantic ? 'semantic' : 'keyword';
        console.log(`\nFound ${results.length} fact${results.length === 1 ? '' : 's'} matching "${options.query}" (${searchMode} search):\n`);
        results.forEach((fact, index) => {
          const projectIndicator = fact.isCurrentProject ? ' ⭐' : '';
          console.log(`${index + 1}. [${fact.type}] ${fact.content}`);
          console.log(`   Project: ${fact.projectName}${projectIndicator} (${fact.projectPath})`);
          if (fact.why) {
            console.log(`   Why: ${fact.why}`);
          }
          if (options.semantic && fact.similarity !== undefined) {
            console.log(`   Similarity: ${(fact.similarity * 100).toFixed(1)}%`);
          }
          console.log(`   Confidence: ${fact.confidence}%`);
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
    <FactsView
      db={db}
      projectPath={process.cwd()}
      initialQuery={options.query}
      type={options.type}
      service={options.service}
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