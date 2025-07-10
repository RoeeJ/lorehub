import { Command } from 'commander';
import { ConfigManager } from '../../core/config.js';
import { EMBEDDING_MODELS } from '../../core/embeddings.js';

export const configCommand = new Command('config')
  .description('Manage LoreHub configuration');

// Get config value
configCommand
  .command('get [key]')
  .description('Get configuration value(s)')
  .action((key?: string) => {
    const config = ConfigManager.getInstance();
    
    if (key) {
      const value = config.get(key as any);
      if (value !== undefined) {
        console.log(`${key}: ${JSON.stringify(value)}`);
      } else {
        console.error(`Unknown configuration key: ${key}`);
        process.exit(1);
      }
    } else {
      // Show all config
      const allConfig = config.getAll();
      console.log('LoreHub Configuration:');
      console.log(JSON.stringify(allConfig, null, 2));
    }
  });

// Set config value
configCommand
  .command('set <key> <value>')
  .description('Set configuration value')
  .action((key: string, value: string) => {
    const config = ConfigManager.getInstance();
    
    try {
      // Special handling for known keys
      switch (key) {
        case 'embeddingModel':
          if (!EMBEDDING_MODELS[value]) {
            console.error(`Invalid embedding model: ${value}`);
            console.error(`Available models: ${Object.keys(EMBEDDING_MODELS).join(', ')}`);
            process.exit(1);
          }
          config.update({
            embeddingModel: value,
            embeddingDimensions: EMBEDDING_MODELS[value].dimensions
          });
          console.log(`✓ Set embedding model to: ${value}`);
          console.log(`Note: Run 'lh migrate-embeddings --force' to re-embed with the new model.`);
          break;
          
        case 'defaultConfidence':
          const confidence = parseInt(value);
          if (isNaN(confidence) || confidence < 0 || confidence > 100) {
            console.error('Confidence must be a number between 0 and 100');
            process.exit(1);
          }
          config.set('defaultConfidence', confidence);
          console.log(`✓ Set default confidence to: ${confidence}`);
          break;
          
        case 'semanticSearchThreshold':
          const threshold = parseFloat(value);
          if (isNaN(threshold) || threshold < 0 || threshold > 10) {
            console.error('Threshold must be a number between 0 and 10 (L2 distance)');
            process.exit(1);
          }
          config.set('semanticSearchThreshold', threshold);
          console.log(`✓ Set semantic search threshold to: ${threshold}`);
          break;
          
        case 'searchMode':
          if (!['literal', 'semantic', 'hybrid'].includes(value)) {
            console.error('Search mode must be one of: literal, semantic, hybrid');
            process.exit(1);
          }
          config.set('searchMode', value as any);
          console.log(`✓ Set default search mode to: ${value}`);
          break;
          
        case 'defaultListLimit':
          const limit = parseInt(value);
          if (isNaN(limit) || limit < 1) {
            console.error('List limit must be a positive number');
            process.exit(1);
          }
          config.set('defaultListLimit', limit);
          console.log(`✓ Set default list limit to: ${limit}`);
          break;
          
        default:
          console.error(`Unknown configuration key: ${key}`);
          console.error('Available keys: embeddingModel, defaultConfidence, semanticSearchThreshold, searchMode, defaultListLimit');
          process.exit(1);
      }
    } catch (error) {
      console.error(`Failed to set configuration: ${error}`);
      process.exit(1);
    }
  });

// Reset config
configCommand
  .command('reset')
  .description('Reset configuration to defaults')
  .action(() => {
    const config = ConfigManager.getInstance();
    config.reset();
    console.log('✓ Configuration reset to defaults');
  });

// List available models
configCommand
  .command('models')
  .description('List available embedding models')
  .action(() => {
    const config = ConfigManager.getInstance();
    const currentModel = config.get('embeddingModel');
    
    console.log('Available embedding models:');
    Object.entries(EMBEDDING_MODELS).forEach(([name, info]) => {
      const marker = name === currentModel ? ' ✓' : '';
      console.log(`  ${name} (${info.dimensions} dimensions)${marker}`);
    });
  });