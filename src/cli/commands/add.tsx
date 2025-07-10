import React from 'react';
import { render } from 'ink';
import { Database } from '../../db/database.js';
import { AddLore } from '../components/AddLore.js';
import { getDbPath } from '../utils/db-config.js';
import { getRealmInfo } from '../utils/realm.js';
import type { LoreType } from '../../core/types.js';

interface AddOptions {
  initialContent?: string;
  type?: LoreType;
  why?: string;
  provinces?: string[];
  sigils?: string[];
  confidence?: number;
}

export async function renderAddLore(options: AddOptions): Promise<void> {
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  
  // If we have content from command line args, use non-interactive mode
  if (options.initialContent && options.initialContent.trim() !== '') {
    try {
      const realmInfo = await getRealmInfo(process.cwd());
      let realm = db.findRealmByPath(process.cwd());
      
      if (!realm) {
        realm = db.createRealm({
          name: realmInfo.name,
          path: realmInfo.path,
          gitRemote: realmInfo.gitRemote,
          isMonorepo: realmInfo.isMonorepo,
          provinces: realmInfo.provinces,
        });
      }
      
      // Check for duplicates before creating
      const potentialDuplicates = await db.checkForDuplicates(
        options.initialContent,
        realm.id,
        0.85
      );
      
      if (potentialDuplicates.length > 0) {
        console.log('\n⚠ Warning: Similar lores already exist:');
        potentialDuplicates.slice(0, 3).forEach((dup, i) => {
          console.log(`  ${i + 1}. [${Math.round(dup.similarity * 100)}% similar] ${dup.content}`);
        });
        console.log('\nAdding lore anyway in non-interactive mode...\n');
      }
      
      const lore = await db.createLore({
        realmId: realm.id,
        content: options.initialContent,
        type: options.type || 'decree',
        why: options.why,
        provinces: options.provinces || [],
        sigils: options.sigils || [],
        confidence: options.confidence || 80,
        origin: {
          type: 'manual',
          reference: 'cli',
          context: `Added via CLI in ${realm.name}`,
        },
      });
      
      console.log('✓ Lore added successfully');
      console.log(`  ID: ${lore.id}`);
      console.log(`  Realm: ${realm.name}`);
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
    <AddLore
      db={db}
      realmPath={process.cwd()}
      initialContent={options.initialContent || ''}
      initialType={options.type}
      initialWhy={options.why}
      initialProvinces={options.provinces}
      initialSigils={options.sigils}
      initialConfidence={options.confidence}
      onComplete={(success: boolean) => {
        if (success && options.initialContent) {
          // For non-interactive mode, show a simple success message
          console.log('✓ Lore added successfully');
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