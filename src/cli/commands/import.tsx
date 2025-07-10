import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import { Database } from '../../db/database.js';
import { getDbPath } from '../utils/db-config.js';
import { Progress } from '../components/Progress.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import type { CreateLoreInput, CreateRealmInput } from '../../core/types.js';
import fs from 'fs/promises';
import path from 'path';

interface ImportProps {
  inputFile: string;
  merge?: boolean;
}

interface ImportData {
  version: string;
  exportDate: string;
  realms: Array<{
    id: string;
    name: string;
    path: string;
    gitRemote: string | null;
    isMonorepo: boolean;
    provinces: string[];
  }>;
  lores: Array<{
    id: string;
    realmId: string;
    content: string;
    type: string;
    status: string;
    confidence: number;
    why: string | null;
    provinces: string[];
    sigils: string[];
    origin: any;
    createdAt: string;
    updatedAt: string;
  }>;
}

function Import({ inputFile, merge = false }: ImportProps) {
  const [status, setStatus] = useState<'loading' | 'importing' | 'success' | 'error'>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<{ realms: number; lores: number } | null>(null);

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
        if (!importData.version || !importData.realms || !importData.lores) {
          throw new Error('Invalid import file format. Missing required fields.');
        }

        setTotalCount(importData.realms.length + importData.lores.length);
        setStatus('importing');

        const dbPath = getDbPath();
        const db = new Database(dbPath);

        // Clear existing data if not merging
        if (!merge) {
          // Get all existing realms and delete their lores
          const existingRealms = db.listRealms();
          for (const realm of existingRealms) {
            const lores = db.listLoresByRealm(realm.id);
            for (const lore of lores) {
              db.deleteLore(lore.id);
            }
          }
        }

        // Import realms
        const realmIdMap = new Map<string, string>(); // old ID -> new ID
        let importedRealms = 0;
        
        for (const realm of importData.realms) {
          setImportedCount(prev => prev + 1);
          
          // Check if realm already exists
          let existingRealm = db.findRealmByPath(realm.path);
          
          if (existingRealm && merge) {
            // Update existing realm
            realmIdMap.set(realm.id, existingRealm.id);
          } else {
            // Create new realm
            const newRealm = db.createRealm({
              name: realm.name,
              path: realm.path,
              gitRemote: realm.gitRemote === null ? undefined : realm.gitRemote,
              isMonorepo: realm.isMonorepo,
              provinces: realm.provinces,
            });
            realmIdMap.set(realm.id, newRealm.id);
            importedRealms++;
          }
        }

        // Import lores
        let importedLores = 0;
        
        for (const lore of importData.lores) {
          setImportedCount(prev => prev + 1);
          
          const newRealmId = realmIdMap.get(lore.realmId);
          if (!newRealmId) {
            console.warn(`Skipping lore: realm ${lore.realmId} not found`);
            continue;
          }

          const loreInput: CreateLoreInput = {
            realmId: newRealmId,
            content: lore.content,
            type: lore.type as any,
            status: lore.status as any,
            confidence: lore.confidence,
            why: lore.why === null ? undefined : lore.why,
            provinces: lore.provinces,
            sigils: lore.sigils,
            origin: lore.origin,
          };

          try {
            await db.createLore(loreInput);
            importedLores++;
          } catch (err) {
            console.warn(`Failed to import lore: ${err}`);
          }
        }

        db.close();
        setSummary({ realms: importedRealms, lores: importedLores });
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
          <Text>• Realms: {summary.realms}</Text>
        </Box>
        <Box>
          <Text>• Lores: {summary.lores}</Text>
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