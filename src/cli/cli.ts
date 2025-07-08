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
    .action(async (query: string, options) => {
      try {
        await renderSearch({
          query,
          type: options.type,
          service: options.service,
          projectPath: options.project,
          currentProjectOnly: options.current,
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

  return program;
}

export function run(argv?: string[]): void {
  const program = createCLI();
  program.parse(argv);
}