import React, { useEffect, useState } from 'react';
import { Command } from 'commander';
import { render, Box, Text } from 'ink';
import { Database } from '../../db/database.js';
import { getDbPath } from '../utils/db-config.js';
import { EmbeddingService, EMBEDDING_MODELS } from '../../core/embeddings.js';
import { Progress } from '../components/Progress.js';
import prompts from 'prompts';

interface MigrateEmbeddingsProps {
  options: {
    realm?: string;
    batchSize: string;
    model?: string;
    force?: boolean;
  };
}

const MigrateEmbeddings: React.FC<MigrateEmbeddingsProps> = ({ options }) => {
  const [status, setStatus] = useState('Initializing embedding service...');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const runMigration = async () => {
      const dbPath = getDbPath();
      const db = new Database(dbPath);

      try {
        // If model is specified, switch to it
        if (options.model) {
          if (!EMBEDDING_MODELS[options.model]) {
            setError(`Unknown embedding model: ${options.model}\nAvailable models: ${Object.keys(EMBEDDING_MODELS).join(', ')}`);
            return;
          }

          const embeddingService = EmbeddingService.getInstance();
          const newDimensions = EMBEDDING_MODELS[options.model]!.dimensions;

          // Check actual table dimensions
          let currentDimensions: number | null = null;
          try {
            const tableInfo = db.sqlite.prepare(`
              SELECT sql FROM sqlite_master 
              WHERE type='table' AND name='lores_vec'
            `).get() as { sql: string } | undefined;

            if (tableInfo) {
              const match = tableInfo.sql.match(/float\[(\d+)\]/);
              if (match && match[1]) {
                currentDimensions = parseInt(match[1]);
              }
            }
          } catch (error) {
            // Table might not exist, that's ok
          }

          setStatus(`Switching to embedding model: ${options.model}`);

          if (currentDimensions !== null && currentDimensions !== newDimensions) {
            // Need to handle dimension mismatch - exit and prompt in parent
            setError(`DIMENSION_MISMATCH:${currentDimensions}:${newDimensions}`);
            db.close();
            return;
          }

          await embeddingService.switchModel(options.model);
        }

        // Count lores based on options
        let query: string;
        if (options.force) {
          query = options.realm
            ? `SELECT COUNT(*) as count FROM lores WHERE realm_id = ?`
            : `SELECT COUNT(*) as count FROM lores`;
        } else {
          query = options.realm
            ? `SELECT COUNT(*) as count FROM lores l LEFT JOIN lores_vec v ON l.id = v.lore_id WHERE v.lore_id IS NULL AND l.realm_id = ?`
            : `SELECT COUNT(*) as count FROM lores l LEFT JOIN lores_vec v ON l.id = v.lore_id WHERE v.lore_id IS NULL`;
        }

        const params = options.realm ? [options.realm] : [];
        const result = db['sqlite'].prepare(query).get(...params) as { count: number };
        const totalLores = result.count;

        if (totalLores === 0) {
          setStatus('All lores already have embeddings!');
          setCompleted(true);
          db.close();
          return;
        }

        const action = options.force ? 're-embedding' : 'generating embeddings for';
        setStatus(`Found ${totalLores} lores. Starting ${action}...`);
        setProgress({ current: 0, total: totalLores });

        // Check dimensions if not switching models
        if (!options.model) {
          try {
            const embeddingService = EmbeddingService.getInstance();
            const testEmbedding = new Float32Array(embeddingService.dimension);
            db.sqlite.prepare(`
              INSERT INTO lores_vec (lore_id, embedding) VALUES ('__test__', ?)
            `).run(testEmbedding);
            db.sqlite.prepare(`DELETE FROM lores_vec WHERE lore_id = '__test__'`).run();
          } catch (error: any) {
            if (error.message?.includes('Dimension mismatch')) {
              setError('The lores_vec table has incompatible dimensions!\nPlease run with --model flag to switch models and recreate the table.');
              db.close();
              return;
            }
          }
        }

        let processed = 0;
        const batchSize = parseInt(options.batchSize);

        while (processed < totalLores) {
          setStatus(`Processing batch...`);
          
          const count = await db.generateMissingEmbeddings(options.realm, batchSize, options.force);
          processed += count;

          if (count === 0) break;

          setProgress({ current: processed, total: totalLores });
        }

        setStatus(`Successfully ${options.force ? 're-embedded' : 'generated embeddings for'} ${processed} lores!`);
        setCompleted(true);
        db.close();
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error));
        db.close();
      }
    };

    runMigration();
  }, [options]);

  if (error) {
    if (error.startsWith('DIMENSION_MISMATCH:')) {
      // Special error that needs to be handled by parent
      process.exit(2);
    }
    return (
      <Box flexDirection="column">
        <Text color="red">✗ Failed to generate embeddings</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  if (completed) {
    return <Text color="green">✓ {status}</Text>;
  }

  return (
    <Box flexDirection="column">
      <Progress
        message={status}
        current={progress?.current}
        total={progress?.total}
        showSpinner={!completed}
      />
    </Box>
  );
};

export const migrateEmbeddingsCommand = new Command('migrate-embeddings')
  .description('Generate embeddings for existing lores or re-embed with a new model')
  .option('-r, --realm <id>', 'Generate embeddings for specific realm only')
  .option('-b, --batch-size <size>', 'Number of lores to process at once', '50')
  .option('-m, --model <name>', 'Embedding model to use (available: ' + Object.keys(EMBEDDING_MODELS).join(', ') + ')')
  .option('-f, --force', 'Force re-embedding even if embeddings already exist')
  .action(async (options) => {
    // Handle dimension mismatch prompting outside of React
    if (options.model) {
      const dbPath = getDbPath();
      const db = new Database(dbPath);
      
      if (!EMBEDDING_MODELS[options.model]) {
        console.error(`✗ Unknown embedding model: ${options.model}`);
        console.error(`Available models: ${Object.keys(EMBEDDING_MODELS).join(', ')}`);
        process.exit(1);
      }

      const newDimensions = EMBEDDING_MODELS[options.model]!.dimensions;
      
      // Check actual table dimensions
      let currentDimensions: number | null = null;
      try {
        const tableInfo = db.sqlite.prepare(`
          SELECT sql FROM sqlite_master 
          WHERE type='table' AND name='lores_vec'
        `).get() as { sql: string } | undefined;
        
        if (tableInfo) {
          const match = tableInfo.sql.match(/float\[(\d+)\]/);
          if (match && match[1]) {
            currentDimensions = parseInt(match[1]);
          }
        }
      } catch (error) {
        // Table might not exist, that's ok
      }

      if (currentDimensions !== null && currentDimensions !== newDimensions) {
        console.log(`\n⚠️  WARNING: Dimension mismatch!`);
        console.log(`Current table: ${currentDimensions} dimensions`);
        console.log(`New model (${options.model}): ${newDimensions} dimensions`);
        console.log(`\nSwitching models requires recreating the embeddings table.`);
        console.log(`This will DELETE all existing embeddings and regenerate them.`);
        
        const response = await prompts({
          type: 'confirm',
          name: 'continue',
          message: 'Do you want to continue?',
          initial: false
        });
        
        if (!response.continue) {
          console.log('Operation cancelled.');
          process.exit(0);
        }
        
        console.log('\nRecreating embeddings table...');
        db.recreateLoresVecTable(newDimensions);
        
        // Force re-embedding all lores
        options.force = true;
      }
      
      db.close();
    }

    const { waitUntilExit } = render(
      <MigrateEmbeddings options={options} />
    );

    try {
      await waitUntilExit();
    } catch (error) {
      process.exit(1);
    }
  });