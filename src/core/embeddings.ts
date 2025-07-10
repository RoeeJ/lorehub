import { pipeline } from '@xenova/transformers';
import { ConfigManager } from './config.js';

export interface EmbeddingConfig {
  model: string;
  dimensions: number;
}

export const EMBEDDING_MODELS: Record<string, EmbeddingConfig> = {
  'all-MiniLM-L6-v2': {
    model: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384
  },
  'all-mpnet-base-v2': {
    model: 'Xenova/all-mpnet-base-v2',
    dimensions: 768
  },
  'gte-small': {
    model: 'Xenova/gte-small',
    dimensions: 384
  }
};

export class EmbeddingService {
  private static instance: EmbeddingService;
  private embedder: any = null;
  private initPromise: Promise<void> | null = null;
  private currentModel: string;
  
  private constructor() {
    const config = ConfigManager.getInstance();
    // Use config first, then env var, then default
    this.currentModel = config.get('embeddingModel') || 
                       process.env.LOREHUB_EMBEDDING_MODEL || 
                       'all-mpnet-base-v2';
  }
  
  async switchModel(modelName: string): Promise<void> {
    if (!EMBEDDING_MODELS[modelName]) {
      throw new Error(`Unknown embedding model: ${modelName}`);
    }
    
    // Reset the embedder to force re-initialization
    this.embedder = null;
    this.initPromise = null;
    this.currentModel = modelName;
    
    // Save to config
    const config = ConfigManager.getInstance();
    config.update({
      embeddingModel: modelName,
      embeddingDimensions: EMBEDDING_MODELS[modelName].dimensions
    });
    
    // Re-initialize with new model
    await this.initialize();
  }
  
  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }
  
  getModelConfig(): EmbeddingConfig {
    const config = EMBEDDING_MODELS[this.currentModel];
    if (!config) {
      throw new Error(`Unknown embedding model: ${this.currentModel}`);
    }
    return config;
  }
  
  getCurrentModel(): string {
    return this.currentModel;
  }
  
  private async initialize(): Promise<void> {
    if (this.embedder) return;
    
    // Only initialize once
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    
    this.initPromise = (async () => {
      const config = this.getModelConfig();
      // Use the configured model for semantic search
      this.embedder = await pipeline(
        'feature-extraction',
        config.model
      );
    })();
    
    await this.initPromise;
  }
  
  async generateEmbedding(text: string): Promise<Float32Array> {
    await this.initialize();
    
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }
    
    // Generate embeddings with mean pooling and normalization
    const output = await this.embedder(text, { 
      pooling: 'mean', 
      normalize: true 
    });
    
    // Convert to Float32Array
    return new Float32Array(output.data);
  }
  
  async generateBatchEmbeddings(texts: string[]): Promise<Float32Array[]> {
    await this.initialize();
    
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }
    
    // Process in batches for efficiency
    const batchSize = 32;
    const embeddings: Float32Array[] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );
      embeddings.push(...batchEmbeddings);
    }
    
    return embeddings;
  }
  
  // Combine lore content, why, and sigils for better semantic representation
  formatLoreForEmbedding(lore: {
    content: string;
    why?: string;
    sigils?: string[];
    type?: string;
  }): string {
    const parts = [lore.content];
    
    if (lore.why) {
      parts.push(`Context: ${lore.why}`);
    }
    
    if (lore.type) {
      parts.push(`Type: ${lore.type}`);
    }
    
    if (lore.sigils && lore.sigils.length > 0) {
      parts.push(`Sigils: ${lore.sigils.join(', ')}`);
    }
    
    return parts.join(' ');
  }
  
  // Get embedding dimension based on current model
  get dimension(): number {
    return this.getModelConfig().dimensions;
  }
}