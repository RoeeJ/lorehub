import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { z } from 'zod';

// Configuration schema
export const ConfigSchema = z.object({
  embeddingModel: z.string().default('all-mpnet-base-v2'),
  embeddingDimensions: z.number().default(768),
  // Add more config options as needed
  defaultConfidence: z.number().min(0).max(100).default(80),
  semanticSearchThreshold: z.number().min(0).max(10).default(2.0), // L2 distance threshold
  searchMode: z.enum(['literal', 'semantic', 'hybrid']).default('literal'),
  defaultListLimit: z.number().min(1).default(50),
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigManager {
  private static instance: ConfigManager;
  private configPath: string;
  private config: Config;

  private constructor() {
    // Store config in ~/.lorehub/config.json
    const lorehubDir = join(homedir(), '.lorehub');
    this.configPath = join(lorehubDir, 'config.json');
    
    // Ensure directory exists
    if (!existsSync(lorehubDir)) {
      mkdirSync(lorehubDir, { recursive: true });
    }
    
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): Config {
    try {
      if (existsSync(this.configPath)) {
        const rawConfig = JSON.parse(readFileSync(this.configPath, 'utf-8'));
        return ConfigSchema.parse(rawConfig);
      }
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error);
    }
    
    // Create default config
    const defaultConfig = ConfigSchema.parse({});
    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  private saveConfig(config: Config): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
    this.saveConfig(this.config);
  }

  getAll(): Config {
    return { ...this.config };
  }

  update(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig(this.config);
  }

  reset(): void {
    this.config = ConfigSchema.parse({});
    this.saveConfig(this.config);
  }
}