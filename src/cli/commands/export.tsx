import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import { Database } from '../../db/database.js';
import { getDbPath } from '../utils/db-config.js';
import { Progress } from '../components/Progress.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import fs from 'fs/promises';
import path from 'path';

interface ExportProps {
  realmPath?: string;
  outputFile: string;
  format: 'json' | 'markdown';
}

function Export({ realmPath, outputFile, format }: ExportProps) {
  const [status, setStatus] = useState<'loading' | 'exporting' | 'success' | 'error'>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [exportedCount, setExportedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    async function performExport() {
      try {
        const dbPath = getDbPath();
        const db = new Database(dbPath);
        
        // Get lores to export
        let lores = [];
        let realms = [];
        
        if (realmPath) {
          const realm = db.findRealmByPath(realmPath);
          if (!realm) {
            throw new Error(`Realm not found at path: ${realmPath}`);
          }
          realms = [realm];
          lores = db.listLoresByRealm(realm.id);
        } else {
          // Export all lores from all realms
          realms = db.listRealms();
          for (const realm of realms) {
            const realmLores = db.listLoresByRealm(realm.id);
            lores.push(...realmLores.map(f => ({ ...f, realmId: realm.id })));
          }
        }

        setTotalCount(lores.length);
        setStatus('exporting');

        // Format data based on requested format
        let output = '';
        
        if (format === 'json') {
          const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            realms: realms.map(p => ({
              id: p.id,
              name: p.name,
              path: p.path,
              gitRemote: p.gitRemote,
              isMonorepo: p.isMonorepo,
              provinces: p.provinces,
            })),
            lores: lores.map((f, index) => {
              setExportedCount(index + 1);
              return {
                id: f.id,
                realmId: f.realmId,
                content: f.content,
                type: f.type,
                status: f.status,
                confidence: f.confidence,
                why: f.why,
                provinces: f.provinces,
                sigils: f.sigils,
                origin: f.origin,
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
          
          for (const realm of realms) {
            const realmLores = lores.filter(f => (f as any).realmId === realm.id || f.realmId === realm.id);
            
            if (realmLores.length === 0) continue;
            
            output += `## Realm: ${realm.name}\n\n`;
            output += `Path: ${realm.path}\n`;
            if (realm.gitRemote) output += `Git: ${realm.gitRemote}\n`;
            output += '\n';
            
            for (const lore of realmLores) {
              setExportedCount(prev => prev + 1);
              output += `### ${lore.type.toUpperCase()}: ${lore.content}\n\n`;
              if (lore.why) output += `**Why**: ${lore.why}\n\n`;
              output += `- **Status**: ${lore.status}\n`;
              output += `- **Confidence**: ${lore.confidence}%\n`;
              output += `- **Created**: ${lore.createdAt.toLocaleDateString()}\n`;
              if (lore.sigils.length > 0) output += `- **Sigils**: ${lore.sigils.join(', ')}\n`;
              if (lore.provinces.length > 0) output += `- **Provinces**: ${lore.provinces.join(', ')}\n`;
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
  }, [realmPath, outputFile, format]);

  if (status === 'loading') {
    return <Progress message="Loading lores..." />;
  }

  if (status === 'exporting') {
    return (
      <Progress 
        message="Exporting lores..." 
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
          'Ensure the realm path is correct (if specified)',
        ]}
      />
    );
  }

  if (status === 'success') {
    return (
      <Box flexDirection="column">
        <Text color="green" bold>✓ Export completed successfully!</Text>
        <Text>Exported {exportedCount} lores to: {path.resolve(outputFile)}</Text>
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