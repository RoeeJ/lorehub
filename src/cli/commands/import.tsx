import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import { Database } from '../../db/database.js';
import { getDbPath } from '../utils/db-config.js';
import { Progress } from '../components/Progress.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import type { CreateFactInput, CreateProjectInput } from '../../core/types.js';
import fs from 'fs/promises';
import path from 'path';

interface ImportProps {
  inputFile: string;
  merge?: boolean;
}

interface ImportData {
  version: string;
  exportDate: string;
  projects: Array<{
    id: string;
    name: string;
    path: string;
    gitRemote: string | null;
    isMonorepo: boolean;
    services: string[];
  }>;
  facts: Array<{
    id: string;
    projectId: string;
    content: string;
    type: string;
    status: string;
    confidence: number;
    why: string | null;
    services: string[];
    tags: string[];
    source: any;
    createdAt: string;
    updatedAt: string;
  }>;
}

function Import({ inputFile, merge = false }: ImportProps) {
  const [status, setStatus] = useState<'loading' | 'importing' | 'success' | 'error'>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<{ projects: number; facts: number } | null>(null);

  useEffect(() => {
    async function performImport() {
      try {
        // Read and parse import file
        const resolvedPath = path.resolve(inputFile);
        const fileContent = await fs.readFile(resolvedPath, 'utf-8');
        
        let importData: ImportData;
        try {
          importData = JSON.parse(fileContent);
        } catch (err) {
          throw new Error('Invalid JSON format. Please ensure the file is a valid LoreHub export.');
        }

        // Validate import data
        if (!importData.version || !importData.projects || !importData.facts) {
          throw new Error('Invalid import file format. Missing required fields.');
        }

        setTotalCount(importData.projects.length + importData.facts.length);
        setStatus('importing');

        const dbPath = getDbPath();
        const db = new Database(dbPath);

        // Clear existing data if not merging
        if (!merge) {
          // Get all existing projects and delete their facts
          const existingProjects = db.listProjects();
          for (const project of existingProjects) {
            const facts = db.listFactsByProject(project.id);
            for (const fact of facts) {
              db.deleteFact(fact.id);
            }
          }
        }

        // Import projects
        const projectIdMap = new Map<string, string>(); // old ID -> new ID
        let importedProjects = 0;
        
        for (const project of importData.projects) {
          setImportedCount(prev => prev + 1);
          
          // Check if project already exists
          let existingProject = db.findProjectByPath(project.path);
          
          if (existingProject && merge) {
            // Update existing project
            projectIdMap.set(project.id, existingProject.id);
          } else {
            // Create new project
            const newProject = db.createProject({
              name: project.name,
              path: project.path,
              gitRemote: project.gitRemote === null ? undefined : project.gitRemote,
              isMonorepo: project.isMonorepo,
              services: project.services,
            });
            projectIdMap.set(project.id, newProject.id);
            importedProjects++;
          }
        }

        // Import facts
        let importedFacts = 0;
        
        for (const fact of importData.facts) {
          setImportedCount(prev => prev + 1);
          
          const newProjectId = projectIdMap.get(fact.projectId);
          if (!newProjectId) {
            console.warn(`Skipping fact: project ${fact.projectId} not found`);
            continue;
          }

          const factInput: CreateFactInput = {
            projectId: newProjectId,
            content: fact.content,
            type: fact.type as any,
            status: fact.status as any,
            confidence: fact.confidence,
            why: fact.why === null ? undefined : fact.why,
            services: fact.services,
            tags: fact.tags,
            source: fact.source,
          };

          try {
            db.createFact(factInput);
            importedFacts++;
          } catch (err) {
            console.warn(`Failed to import fact: ${err}`);
          }
        }

        db.close();
        setSummary({ projects: importedProjects, facts: importedFacts });
        setStatus('success');
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Import failed'));
        setStatus('error');
      }
    }

    performImport();
  }, [inputFile, merge]);

  if (status === 'loading') {
    return <Progress message="Reading import file..." />;
  }

  if (status === 'importing') {
    return (
      <Progress 
        message="Importing data..." 
        current={importedCount} 
        total={totalCount}
      />
    );
  }

  if (status === 'error' && error) {
    return (
      <ErrorMessage 
        error={error} 
        context="Import"
        suggestions={[
          'Check if the import file exists and is readable',
          'Ensure the file is a valid LoreHub export (JSON format)',
          'Use --merge flag to add to existing data instead of replacing',
        ]}
      />
    );
  }

  if (status === 'success' && summary) {
    return (
      <Box flexDirection="column">
        <Text color="green" bold>✓ Import completed successfully!</Text>
        <Text>Imported from: {path.resolve(inputFile)}</Text>
        <Box marginTop={1}>
          <Text>• Projects: {summary.projects}</Text>
        </Box>
        <Box>
          <Text>• Facts: {summary.facts}</Text>
        </Box>
        {merge && (
          <Box marginTop={1}>
            <Text dimColor>Mode: Merge (existing data preserved)</Text>
          </Box>
        )}
      </Box>
    );
  }

  return null;
}

export async function renderImport(options: ImportProps): Promise<void> {
  const { waitUntilExit } = render(<Import {...options} />);
  await waitUntilExit();
}