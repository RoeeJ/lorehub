import React from 'react';
import { render } from 'ink';
import { Database } from '../../db/database.js';
import { getDbPath } from '../utils/db-config.js';
import { ConfigManager } from '../../core/config.js';
import { LoresView } from '../components/LoresView.js';

interface BrowseOptions {
  query?: string;
  type?: string;
  province?: string;
  realmPath?: string;
  currentRealmOnly?: boolean;
  searchMode?: 'literal' | 'semantic' | 'hybrid';
}

export async function renderBrowse(options: BrowseOptions): Promise<void> {
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  const config = ConfigManager.getInstance();
  
  // Non-interactive fallback
  if (!process.stdin.isTTY) {
    try {
      let results: any[] = [];
      const realms = db.listRealms();
      
      // Filter realms
      let realmsToSearch = realms;
      if (options.currentRealmOnly) {
        const currentRealm = db.findRealmByPath(process.cwd());
        if (currentRealm) realmsToSearch = [currentRealm];
      } else if (options.realmPath) {
        const specificRealm = db.findRealmByPath(options.realmPath);
        if (specificRealm) realmsToSearch = [specificRealm];
      }
      
      const searchMode = options.searchMode || config.get('searchMode') || 'literal';
      
      // Search or list
      for (const realm of realmsToSearch) {
        if (options.query) {
          if (searchMode === 'semantic') {
            const semanticResults = await db.semanticSearchLores(options.query, {
              realmId: realm.id,
              includeScore: true,
              threshold: config.get('semanticSearchThreshold')
            });
            results.push(...semanticResults);
          } else {
            const literalResults = db.searchLores(realm.id, options.query);
            results.push(...literalResults);
          }
        } else {
          if (options.type) {
            results.push(...db.listLoresByType(realm.id, options.type as any));
          } else if (options.province) {
            results.push(...db.listLoresByProvince(realm.id, options.province));
          } else {
            results.push(...db.listLoresByRealm(realm.id));
          }
        }
      }
      
      // Sort and limit
      results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const limit = config.get('defaultListLimit') || 100;
      if (results.length > limit) {
        results = results.slice(0, limit);
      }
      
      // Display results
      console.log(`\nLores (${results.length}):\n`);
      results.forEach((lore, index) => {
        const realm = db.findRealm(lore.realmId);
        console.log(`${index + 1}. [${lore.type}] ${lore.content}`);
        console.log(`   Realm: ${realm?.name || 'Unknown'} (${realm?.path || 'Unknown'})`);
        if (lore.why) console.log(`   Why: ${lore.why}`);
        console.log(`   Created: ${lore.createdAt.toLocaleString()}`);
        console.log(`   Status: ${lore.status} | Confidence: ${lore.confidence}%`);
        if (lore.sigils && lore.sigils.length > 0) {
          console.log(`   Sigils: ${lore.sigils.join(', ')}`);
        }
        console.log('');
      });
    } finally {
      db.close();
    }
    return;
  }
  
  // Interactive mode - use LoresView directly
  try {
    const { waitUntilExit } = render(
      <LoresView 
        db={db}
        realmPath={process.cwd()}
        initialQuery={options.query}
        searchMode={options.searchMode}
        type={options.type}
        province={options.province}
        filterRealmPath={options.realmPath}
        currentRealmOnly={options.currentRealmOnly}
        limit={config.get('defaultListLimit') || 100}
      />,
      { 
        exitOnCtrlC: true // Exit on Ctrl+C
      }
    );
    
    await waitUntilExit();
  } finally {
    db.close();
  }
}