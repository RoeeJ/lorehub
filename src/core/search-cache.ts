import crypto from 'crypto';
import type { Lore } from './types.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface EmbeddingCacheEntry extends CacheEntry<Float32Array> {}
interface ResultsCacheEntry extends CacheEntry<(Lore & { similarity?: number })[]> {}

export class SearchCache {
  private embeddingCache = new Map<string, EmbeddingCacheEntry>();
  private resultsCache = new Map<string, ResultsCacheEntry>();
  
  // Cache TTLs in milliseconds
  private readonly EMBEDDING_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly RESULTS_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Maximum cache sizes
  private readonly MAX_EMBEDDING_ENTRIES = 100;
  private readonly MAX_RESULTS_ENTRIES = 50;

  getEmbedding(query: string): Float32Array | null {
    const entry = this.embeddingCache.get(query);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.embeddingCache.delete(query);
      return null;
    }
    
    return entry.data;
  }

  setEmbedding(query: string, embedding: Float32Array): void {
    // Evict oldest entries if cache is full
    if (this.embeddingCache.size >= this.MAX_EMBEDDING_ENTRIES) {
      const oldestKey = this.findOldestEntry(this.embeddingCache);
      if (oldestKey) this.embeddingCache.delete(oldestKey);
    }
    
    this.embeddingCache.set(query, {
      data: embedding,
      expiresAt: Date.now() + this.EMBEDDING_TTL
    });
  }

  getResults(
    query: string,
    options: { realmId?: string; threshold?: number; limit?: number }
  ): (Lore & { similarity?: number })[] | null {
    const key = this.generateResultsKey(query, options);
    const entry = this.resultsCache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.resultsCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  setResults(
    query: string,
    options: { realmId?: string; threshold?: number; limit?: number },
    results: (Lore & { similarity?: number })[]
  ): void {
    // Evict oldest entries if cache is full
    if (this.resultsCache.size >= this.MAX_RESULTS_ENTRIES) {
      const oldestKey = this.findOldestEntry(this.resultsCache);
      if (oldestKey) this.resultsCache.delete(oldestKey);
    }
    
    const key = this.generateResultsKey(query, options);
    this.resultsCache.set(key, {
      data: results,
      expiresAt: Date.now() + this.RESULTS_TTL
    });
  }

  clear(): void {
    this.embeddingCache.clear();
    this.resultsCache.clear();
  }

  clearExpired(): void {
    const now = Date.now();
    
    // Clear expired embeddings
    for (const [key, entry] of this.embeddingCache) {
      if (now > entry.expiresAt) {
        this.embeddingCache.delete(key);
      }
    }
    
    // Clear expired results
    for (const [key, entry] of this.resultsCache) {
      if (now > entry.expiresAt) {
        this.resultsCache.delete(key);
      }
    }
  }

  getCacheStats() {
    return {
      embeddings: {
        size: this.embeddingCache.size,
        maxSize: this.MAX_EMBEDDING_ENTRIES
      },
      results: {
        size: this.resultsCache.size,
        maxSize: this.MAX_RESULTS_ENTRIES
      }
    };
  }

  private generateResultsKey(
    query: string,
    options: { realmId?: string; threshold?: number; limit?: number }
  ): string {
    const parts = [
      query,
      options.realmId || 'global',
      options.threshold?.toString() || 'none',
      options.limit?.toString() || 'all'
    ];
    
    return crypto
      .createHash('sha256')
      .update(parts.join('|'))
      .digest('hex');
  }

  private findOldestEntry<T>(cache: Map<string, CacheEntry<T>>): string | null {
    let oldestKey: string | null = null;
    let oldestExpiry = Infinity;
    
    for (const [key, entry] of cache) {
      if (entry.expiresAt < oldestExpiry) {
        oldestExpiry = entry.expiresAt;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }
}

// Singleton instance
let cacheInstance: SearchCache | null = null;

export function getSearchCache(): SearchCache {
  if (!cacheInstance) {
    cacheInstance = new SearchCache();
    
    // Set up periodic cleanup
    setInterval(() => {
      cacheInstance?.clearExpired();
    }, 60 * 1000); // Clean up every minute
  }
  
  return cacheInstance;
}