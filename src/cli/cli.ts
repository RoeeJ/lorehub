import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Database } from '../db/database.js';
import { getRealmInfo } from './utils/realm.js';
import { getDbPath } from './utils/db-config.js';
import { renderAddLore } from './commands/add.js';
import { renderBrowse } from './commands/browse.js';
import { renderRealmInfo } from './commands/realm.js';
import { renderExport } from './commands/export.js';
import { renderImport } from './commands/import.js';
import { migrateEmbeddingsCommand } from './commands/migrate-embeddings.js';
import { configCommand } from './commands/config.js';
import { EmbeddingService } from '../core/embeddings.js';
import { ConfigManager } from '../core/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);

export function createCLI(): Command {
  const program = new Command();

  program
    .name('lh')
    .description('LoreHub - Capture and query your realm\'s development knowledge')
    .version(packageJson.version);

  // Add command
  program
    .command('add [content...]')
    .description('Add a new lore to your realm')
    .option('-t, --type <type>', 'Lore type (decree, lesson, assumption, etc.)')
    .option('-w, --why <reason>', 'Why this lore exists')
    .option('-s, --provinces <provinces>', 'Comma-separated list of provinces')
    .option('--sigils <sigils>', 'Comma-separated list of sigils')
    .option('-c, --confidence <number>', 'Confidence level (0-100)')
    .action(async (contentParts: string[], options) => {
      const content = contentParts.join(' ');
      const config = ConfigManager.getInstance();
      
      try {
        if (!content && !process.stdin.isTTY) {
          console.error('Error: No content provided');
          process.exit(1);
        }

        // Use config default if confidence not specified
        const confidence = options.confidence 
          ? parseInt(options.confidence, 10)
          : config.get('defaultConfidence');

        await renderAddLore({
          initialContent: content,
          type: options.type,
          why: options.why,
          provinces: options.provinces?.split(',').map((s: string) => s.trim()),
          sigils: options.sigils?.split(',').map((t: string) => t.trim()),
          confidence,
        });
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Browse command (new unified interface)
  program
    .command('browse [query]')
    .alias('b')
    .description('Browse and search lores with unified interface')
    .option('-t, --type <type>', 'Filter by lore type')
    .option('-s, --province <province>', 'Filter by province')
    .option('-r, --realm <path>', 'Filter by specific realm path')
    .option('--current', 'Browse only current realm')
    .option('-m, --mode <mode>', 'Search mode: literal, semantic, or hybrid')
    .action(async (query: string | undefined, options) => {
      try {
        await renderBrowse({
          query,
          type: options.type,
          province: options.province,
          realmPath: options.realm,
          currentRealmOnly: options.current,
          searchMode: options.mode as 'literal' | 'semantic' | 'hybrid' | undefined,
        });
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Realm command
  program
    .command('realm')
    .description('Show current realm information')
    .action(async () => {
      try {
        if (!process.stdin.isTTY) {
          // Non-interactive mode
          const dbPath = getDbPath();
          const db = new Database(dbPath);
          const realmInfo = await getRealmInfo(process.cwd());
          
          const realm = db.findRealmByPath(realmInfo.path);
          
          if (realm) {
            console.log(`\nRealm: ${realm.name}`);
            console.log(`Path: ${realm.path}`);
            console.log(`Type: ${realm.isMonorepo ? 'Monorepo' : 'Standard'}`);
            if (realm.provinces.length > 0) {
              console.log(`Provinces: ${realm.provinces.join(', ')}`);
            }
            if (realm.gitRemote) {
              console.log(`Git: ${realm.gitRemote}`);
            }
            console.log(`Created: ${realm.createdAt.toLocaleDateString()}`);
            console.log(`Last seen: ${realm.lastSeen.toLocaleDateString()}`);
            
            const lores = db.listLoresByRealm(realm.id);
            console.log(`\nLores: ${lores.length}`);
            
            const loresByType = lores.reduce((acc, lore) => {
              acc[lore.type] = (acc[lore.type] || 0) + 1;
              return acc;
          }, {} as Record<string, number>);
          
          Object.entries(loresByType).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
          });
          
          // Show embedding info
          const embeddingService = EmbeddingService.getInstance();
          const modelConfig = embeddingService.getModelConfig();
          console.log(`\nEmbedding Configuration:`);
          console.log(`Model: ${embeddingService.getCurrentModel()}`);
          console.log(`Dimensions: ${modelConfig.dimensions}`);
        } else {
          console.log('No LoreHub realm found in this directory.');
          console.log('Run "lh add" to create your first lore.');
        }
        
        db.close();
      } else {
        // Interactive mode with Ink
        await renderRealmInfo();
      }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Export command
  program
    .command('export <output>')
    .description('Export lores to a file')
    .option('-r, --realm <path>', 'Export lores from specific realm only')
    .option('-f, --format <format>', 'Output format (json, markdown)', 'json')
    .action(async (output: string, options) => {
      try {
        await renderExport({
          realmPath: options.realm,
          outputFile: output,
          format: options.format,
        });
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Import command
  program
    .command('import <input>')
    .description('Import lores from a file')
    .option('-m, --merge', 'Merge with existing data (default: replace)')
    .action(async (input: string, options) => {
      try {
        await renderImport({
          inputFile: input,
          merge: options.merge || false,
        });
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Similar command
  program
    .command('similar <loreId>')
    .description('Find lores similar to a given lore (kindred lores)')
    .option('-l, --limit <number>', 'Maximum number of kindred lores to show', '10')
    .option('-t, --threshold <number>', 'Similarity threshold (0-1)', '0.5')
    .action(async (loreId: string, options) => {
      try {
        const dbPath = getDbPath();
        const db = new Database(dbPath);
        
        const lore = db.findLore(loreId);
        if (!lore) {
          console.error(`Lore with ID ${loreId} not found`);
          process.exit(1);
        }
        
        console.log(`\nFinding lores similar to:\n[${lore.type}] ${lore.content}\n`);
        
        const similarLores = await db.findSimilarLores(loreId, {
          limit: parseInt(options.limit),
          threshold: parseFloat(options.threshold)
        });
        
        if (similarLores.length === 0) {
          console.log('No kindred lores found');
        } else {
          console.log(`Found ${similarLores.length} kindred lore${similarLores.length === 1 ? '' : 's'}:\n`);
          similarLores.forEach((similar, index) => {
            const realm = db.findRealm((similar as any).realmId || similar.realmId);
            console.log(`${index + 1}. [${similar.type}] ${similar.content}`);
            console.log(`   Similarity: ${(similar.similarity * 100).toFixed(1)}%`);
            console.log(`   Realm: ${realm?.name || 'Unknown'} (${realm?.path || 'Unknown'})`);
            if (similar.why) {
              console.log(`   Why: ${similar.why}`);
            }
            console.log('');
          });
        }
        
        db.close();
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Migrate embeddings command
  program.addCommand(migrateEmbeddingsCommand);

  // Config command
  program.addCommand(configCommand);

  return program;
}

export async function run(argv?: string[]): Promise<void> {
  const program = createCLI();
  const args = argv || process.argv;
  
  // If no arguments provided, default to browse command
  if (args.length === 2) {
    // argv is like ['node', 'script.js'] when no args
    await renderBrowse({});
    return;
  }
  
  program.parse(args);
}