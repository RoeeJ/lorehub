import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Database } from '../db/database.js';
import { getProjectInfo } from './utils/project.js';
import { getDbPath } from './utils/db-config.js';
import { renderAddFact } from './commands/add.js';
import { renderSearch } from './commands/search.js';
import { renderList } from './commands/list.js';
import { renderProjectInfo } from './commands/project.js';
import { renderExport } from './commands/export.js';
import { renderImport } from './commands/import.js';

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
    .description('LoreHub - Capture and query your project\'s development knowledge')
    .version(packageJson.version);

  // Add command
  program
    .command('add [content...]')
    .description('Add a new fact to your project')
    .option('-t, --type <type>', 'Fact type (decision, learning, assumption, etc.)')
    .option('-w, --why <reason>', 'Why this fact exists')
    .option('-s, --services <services>', 'Comma-separated list of services')
    .option('--tags <tags>', 'Comma-separated list of tags')
    .option('-c, --confidence <number>', 'Confidence level (0-100)', '80')
    .action(async (contentParts: string[], options) => {
      const content = contentParts.join(' ');
      
      try {
        if (!content && !process.stdin.isTTY) {
          console.error('Error: No content provided');
          process.exit(1);
        }

        await renderAddFact({
          initialContent: content,
          type: options.type,
          why: options.why,
          services: options.services?.split(',').map((s: string) => s.trim()),
          tags: options.tags?.split(',').map((t: string) => t.trim()),
          confidence: parseInt(options.confidence, 10),
        });
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Search command
  program
    .command('search <query>')
    .description('Search facts across all projects (supports * and ? wildcards)')
    .option('-t, --type <type>', 'Filter by fact type')
    .option('-s, --service <service>', 'Filter by service')
    .option('-p, --project <path>', 'Filter by specific project path')
    .option('--current', 'Search only in current project')
    .option('--semantic', 'Use semantic search to find conceptually similar facts')
    .option('--threshold <number>', 'Similarity threshold for semantic search (0-1)', '0.3')
    .action(async (query: string, options) => {
      try {
        await renderSearch({
          query,
          type: options.type,
          service: options.service,
          projectPath: options.project,
          currentProjectOnly: options.current,
          semantic: options.semantic,
          threshold: parseFloat(options.threshold),
        });
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // List command
  program
    .command('list')
    .alias('ls')
    .description('List facts from all projects')
    .option('-t, --type <type>', 'Filter by fact type')
    .option('-s, --service <service>', 'Filter by service')
    .option('-n, --limit <number>', 'Limit results', '20')
    .option('-p, --project <path>', 'Filter by specific project path')
    .option('--current', 'List only from current project')
    .action(async (options) => {
      try {
        await renderList({
          type: options.type,
          service: options.service,
          limit: parseInt(options.limit, 10),
          projectPath: options.project,
          currentProjectOnly: options.current,
        });
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Project command
  program
    .command('project')
    .description('Show current project information')
    .action(async () => {
      try {
        if (!process.stdin.isTTY) {
          // Non-interactive mode
          const dbPath = getDbPath();
          const db = new Database(dbPath);
          const projectInfo = await getProjectInfo(process.cwd());
          
          const project = db.findProjectByPath(projectInfo.path);
          
          if (project) {
            console.log(`\nProject: ${project.name}`);
            console.log(`Path: ${project.path}`);
            console.log(`Type: ${project.isMonorepo ? 'Monorepo' : 'Standard'}`);
            if (project.services.length > 0) {
              console.log(`Services: ${project.services.join(', ')}`);
            }
            if (project.gitRemote) {
              console.log(`Git: ${project.gitRemote}`);
            }
            console.log(`Created: ${project.createdAt.toLocaleDateString()}`);
            console.log(`Last seen: ${project.lastSeen.toLocaleDateString()}`);
            
            const facts = db.listFactsByProject(project.id);
            console.log(`\nFacts: ${facts.length}`);
            
            const factsByType = facts.reduce((acc, fact) => {
              acc[fact.type] = (acc[fact.type] || 0) + 1;
              return acc;
          }, {} as Record<string, number>);
          
          Object.entries(factsByType).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
          });
        } else {
          console.log('No LoreHub project found in this directory.');
          console.log('Run "lh add" to create your first fact.');
        }
        
        db.close();
      } else {
        // Interactive mode with Ink
        await renderProjectInfo();
      }
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  // Export command
  program
    .command('export <output>')
    .description('Export facts to a file')
    .option('-p, --project <path>', 'Export facts from specific project only')
    .option('-f, --format <format>', 'Output format (json, markdown)', 'json')
    .action(async (output: string, options) => {
      try {
        await renderExport({
          projectPath: options.project,
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
    .description('Import facts from a file')
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
    .command('similar <factId>')
    .description('Find facts similar to a given fact')
    .option('-l, --limit <number>', 'Maximum number of similar facts to show', '10')
    .option('-t, --threshold <number>', 'Similarity threshold (0-1)', '0.5')
    .action(async (factId: string, options) => {
      try {
        const dbPath = getDbPath();
        const db = new Database(dbPath);
        
        const fact = db.findFact(factId);
        if (!fact) {
          console.error(`Fact with ID ${factId} not found`);
          process.exit(1);
        }
        
        console.log(`\nFinding facts similar to:\n[${fact.type}] ${fact.content}\n`);
        
        const similarFacts = await db.findSimilarFacts(factId, {
          limit: parseInt(options.limit),
          threshold: parseFloat(options.threshold)
        });
        
        if (similarFacts.length === 0) {
          console.log('No similar facts found');
        } else {
          console.log(`Found ${similarFacts.length} similar fact${similarFacts.length === 1 ? '' : 's'}:\n`);
          similarFacts.forEach((similar, index) => {
            const project = db.findProject(similar.projectId);
            console.log(`${index + 1}. [${similar.type}] ${similar.content}`);
            console.log(`   Similarity: ${(similar.similarity * 100).toFixed(1)}%`);
            console.log(`   Project: ${project?.name || 'Unknown'} (${project?.path || 'Unknown'})`);
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
  program
    .command('migrate-embeddings')
    .description('Generate embeddings for existing facts')
    .option('-p, --project <id>', 'Generate embeddings for specific project only')
    .option('-b, --batch-size <size>', 'Number of facts to process at once', '50')
    .action(async (options) => {
      const dbPath = getDbPath();
      const db = new Database(dbPath);
      
      console.log('Initializing embedding service...');
      
      try {
        // Count facts without embeddings
        const query = options.project
          ? `SELECT COUNT(*) as count FROM facts WHERE (embedding_generated = 0 OR embedding_generated IS NULL) AND project_id = ?`
          : `SELECT COUNT(*) as count FROM facts WHERE embedding_generated = 0 OR embedding_generated IS NULL`;
        
        const params = options.project ? [options.project] : [];
        const result = db['sqlite'].prepare(query).get(...params) as { count: number };
        const totalFacts = result.count;
        
        if (totalFacts === 0) {
          console.log('✓ All facts already have embeddings!');
          db.close();
          return;
        }
        
        console.log(`Found ${totalFacts} facts without embeddings. Starting migration...`);
        
        let processed = 0;
        const batchSize = parseInt(options.batchSize);
        
        while (processed < totalFacts) {
          console.log(`Processing facts ${processed + 1}-${Math.min(processed + batchSize, totalFacts)} of ${totalFacts}...`);
          
          const count = await db.generateMissingEmbeddings(options.project, batchSize);
          processed += count;
          
          if (count === 0) {
            // No more facts to process
            break;
          }
          
          // Update progress
          const percentage = Math.round((processed / totalFacts) * 100);
          console.log(`Progress: ${percentage}% (${processed}/${totalFacts} facts)`);
        }
        
        console.log(`✓ Successfully generated embeddings for ${processed} facts!`);
      } catch (error) {
        console.error('✗ Failed to generate embeddings');
        console.error(error);
        process.exit(1);
      } finally {
        db.close();
      }
    });

  return program;
}

export async function run(argv?: string[]): Promise<void> {
  const program = createCLI();
  const args = argv || process.argv;
  
  // If no arguments provided, default to list command
  if (args.length === 2) {
    // argv is like ['node', 'script.js'] when no args
    await renderList({ limit: 20 });
    return;
  }
  
  program.parse(args);
}