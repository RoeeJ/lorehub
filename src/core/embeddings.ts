import { pipeline } from '@xenova/transformers';

export class EmbeddingService {
  private static instance: EmbeddingService;
  private embedder: any = null;
  private initPromise: Promise<void> | null = null;
  
  private constructor() {}
  
  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }
  
  private async initialize(): Promise<void> {
    if (this.embedder) return;
    
    // Only initialize once
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    
    this.initPromise = (async () => {
      // Use the recommended model for semantic search
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
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
  
  // Combine fact content, why, and tags for better semantic representation
  formatFactForEmbedding(fact: {
    content: string;
    why?: string;
    tags?: string[];
    type?: string;
  }): string {
    const parts = [fact.content];
    
    if (fact.why) {
      parts.push(`Context: ${fact.why}`);
    }
    
    if (fact.type) {
      parts.push(`Type: ${fact.type}`);
    }
    
    if (fact.tags && fact.tags.length > 0) {
      parts.push(`Tags: ${fact.tags.join(', ')}`);
    }
    
    return parts.join(' ');
  }
  
  // Get embedding dimension (all-MiniLM-L6-v2 uses 384)
  get dimension(): number {
    return 384;
  }
}