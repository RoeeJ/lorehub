import { Command } from 'commander';
import { Database } from '../../db/database.js';
import { getDbPath } from '../utils/db-config.js';

export const migrateEmbeddingsCommand = new Command('migrate-embeddings')
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
        ? `SELECT COUNT(*) as count FROM facts WHERE (embedding_generated = 0 OR embedding_generated IS NULL) AND projectId = ?`
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