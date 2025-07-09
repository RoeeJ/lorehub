import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import { Database } from '../../db/database.js';
import { getDbPath } from '../utils/db-config.js';
import { Progress } from '../components/Progress.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import fs from 'fs/promises';
import path from 'path';

interface ExportProps {
  projectPath?: string;
  outputFile: string;
  format: 'json' | 'markdown';
}

function Export({ projectPath, outputFile, format }: ExportProps) {
  const [status, setStatus] = useState<'loading' | 'exporting' | 'success' | 'error'>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [exportedCount, setExportedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    async function performExport() {
      try {
        const dbPath = getDbPath();
        const db = new Database(dbPath);
        
        // Get facts to export
        let facts = [];
        let projects = [];
        
        if (projectPath) {
          const project = db.findProjectByPath(projectPath);
          if (!project) {
            throw new Error(`Project not found at path: ${projectPath}`);
          }
          projects = [project];
          facts = db.listFactsByProject(project.id);
        } else {
          // Export all facts from all projects
          projects = db.listProjects();
          for (const project of projects) {
            const projectFacts = db.listFactsByProject(project.id);
            facts.push(...projectFacts.map(f => ({ ...f, projectId: project.id })));
          }
        }

        setTotalCount(facts.length);
        setStatus('exporting');

        // Format data based on requested format
        let output = '';
        
        if (format === 'json') {
          const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            projects: projects.map(p => ({
              id: p.id,
              name: p.name,
              path: p.path,
              gitRemote: p.gitRemote,
              isMonorepo: p.isMonorepo,
              services: p.services,
            })),
            facts: facts.map((f, index) => {
              setExportedCount(index + 1);
              return {
                id: f.id,
                projectId: f.projectId,
                content: f.content,
                type: f.type,
                status: f.status,
                confidence: f.confidence,
                why: f.why,
                services: f.services,
                tags: f.tags,
                source: f.source,
                createdAt: f.createdAt.toISOString(),
                updatedAt: f.updatedAt.toISOString(),
              };
            }),
          };
          output = JSON.stringify(exportData, null, 2);
        } else {
          // Markdown format
          output = '# LoreHub Export\n\n';
          output += `Export Date: ${new Date().toLocaleString()}\n\n`;
          
          for (const project of projects) {
            const projectFacts = facts.filter(f => f.projectId === project.id);
            
            if (projectFacts.length === 0) continue;
            
            output += `## Project: ${project.name}\n\n`;
            output += `Path: ${project.path}\n`;
            if (project.gitRemote) output += `Git: ${project.gitRemote}\n`;
            output += '\n';
            
            for (const fact of projectFacts) {
              setExportedCount(prev => prev + 1);
              output += `### ${fact.type.toUpperCase()}: ${fact.content}\n\n`;
              if (fact.why) output += `**Why**: ${fact.why}\n\n`;
              output += `- **Status**: ${fact.status}\n`;
              output += `- **Confidence**: ${fact.confidence}%\n`;
              output += `- **Created**: ${fact.createdAt.toLocaleDateString()}\n`;
              if (fact.tags.length > 0) output += `- **Tags**: ${fact.tags.join(', ')}\n`;
              if (fact.services.length > 0) output += `- **Services**: ${fact.services.join(', ')}\n`;
              output += '\n---\n\n';
            }
          }
        }

        // Write to file
        const resolvedPath = path.resolve(outputFile);
        await fs.writeFile(resolvedPath, output, 'utf-8');
        
        db.close();
        setStatus('success');
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Export failed'));
        setStatus('error');
      }
    }

    performExport();
  }, [projectPath, outputFile, format]);

  if (status === 'loading') {
    return <Progress message="Loading facts..." />;
  }

  if (status === 'exporting') {
    return (
      <Progress 
        message="Exporting facts..." 
        current={exportedCount} 
        total={totalCount}
      />
    );
  }

  if (status === 'error' && error) {
    return (
      <ErrorMessage 
        error={error} 
        context="Export"
        suggestions={[
          'Check if the output path is writable',
          'Ensure the project path is correct (if specified)',
        ]}
      />
    );
  }

  if (status === 'success') {
    return (
      <Box flexDirection="column">
        <Text color="green" bold>✓ Export completed successfully!</Text>
        <Text>Exported {exportedCount} facts to: {path.resolve(outputFile)}</Text>
        <Text dimColor>Format: {format}</Text>
      </Box>
    );
  }

  return null;
}

export async function renderExport(options: ExportProps): Promise<void> {
  const { waitUntilExit } = render(<Export {...options} />);
  await waitUntilExit();
}