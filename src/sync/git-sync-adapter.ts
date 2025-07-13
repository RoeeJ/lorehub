import { simpleGit } from 'simple-git';
import type { SimpleGit } from 'simple-git';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import path from 'path';
import { homedir } from 'os';
import { v4 as uuidv4 } from '../utils/uuid.js';
import type { 
  Workspace, 
  Lore, 
  Realm, 
  LoreRelation,
  CreateLoreInput,
  CreateRelationInput,
  CreateRealmInput
} from '../core/types.js';
import { Database } from '../db/database.js';
import { ChangeTracker } from './change-tracker.js';

export interface SyncManifest {
  version: '1.0.0';
  workspaceId: string;
  workspaceName: string;
  created: Date;
  lastSync: Date;
  deviceId: string;
  syncProtocol: 'git-v1';
}

export interface ChangeEvent {
  id: string;
  timestamp: Date;
  deviceId: string;
  operation: 'create' | 'update' | 'delete' | 'archive';
  entity: 'lore' | 'realm' | 'relation';
  entityId: string;
  data?: any;
  metadata?: {
    realmId?: string;
    workspaceId?: string;
  };
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: number;
  errors: string[];
}

export class GitSyncAdapter {
  private git: SimpleGit;
  private syncPath: string;
  private workspace: Workspace;
  private deviceId: string;
  private db: Database;
  
  constructor(workspace: Workspace, db: Database) {
    this.workspace = workspace;
    this.db = db;
    this.deviceId = this.getOrCreateDeviceId();
    
    // Initialize sync directory
    const lorehubHome = join(homedir(), '.lorehub');
    this.syncPath = join(lorehubHome, 'sync', 'repos', workspace.id);
    
    // Ensure directory exists
    mkdirSync(this.syncPath, { recursive: true });
    
    // Initialize simple-git
    this.git = simpleGit(this.syncPath);
  }
  
  async initialize(): Promise<void> {
    // Check if already initialized
    const isRepo = await this.git.checkIsRepo();
    
    if (!isRepo) {
      // Initialize new repo
      await this.git.init();
      
      // Create initial manifest
      const manifest: SyncManifest = {
        version: '1.0.0',
        workspaceId: this.workspace.id,
        workspaceName: this.workspace.name,
        created: new Date(),
        lastSync: new Date(),
        deviceId: this.deviceId,
        syncProtocol: 'git-v1',
      };
      
      this.writeJsonFile('manifest.json', manifest);
      
      // Create directory structure
      mkdirSync(join(this.syncPath, 'changes'), { recursive: true });
      mkdirSync(join(this.syncPath, 'state'), { recursive: true });
      
      // Initial commit
      await this.git.add('.');
      await this.git.commit('Initialize lorehub sync repository');
      
      // Add remote if configured
      if (this.workspace.syncRepo) {
        await this.git.addRemote('origin', this.workspace.syncRepo);
      }
    }
    
    // Ensure we're on the correct branch
    const branches = await this.git.branch();
    const syncBranch = this.workspace.syncBranch || 'main';
    if (!branches.all.includes(syncBranch)) {
      await this.git.checkoutLocalBranch(syncBranch);
    } else {
      await this.git.checkout(syncBranch);
    }
  }
  
  async recordChange(change: Omit<ChangeEvent, 'id' | 'timestamp' | 'deviceId'>): Promise<void> {
    const event: ChangeEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      deviceId: this.deviceId,
      ...change,
    };
    
    // Write change to daily directory
    const date = new Date().toISOString().split('T')[0]!;
    const changesDir = join(this.syncPath, 'changes', date);
    mkdirSync(changesDir, { recursive: true });
    
    const filename = `${Date.now()}-${this.deviceId}-${change.operation}.json`;
    const relativePath = join('changes', date, filename);
    this.writeJsonFile(relativePath, event);
    
    // Update last sync time
    const manifest = this.readJsonFile<SyncManifest>('manifest.json');
    manifest.lastSync = new Date();
    this.writeJsonFile('manifest.json', manifest);
  }
  
  async push(): Promise<SyncResult> {
    const result: SyncResult = {
      pulled: 0,
      pushed: 0,
      conflicts: 0,
      errors: [],
    };
    
    try {
      // Stage all changes
      await this.git.add('.');
      
      // Check if there are changes to commit
      const status = await this.git.status();
      if (status.files.length > 0) {
        // Commit changes
        const message = `Sync from ${this.deviceId} at ${new Date().toISOString()}`;
        await this.git.commit(message);
        result.pushed = status.files.length;
      }
      
      // Push to remote if configured
      if (this.workspace.syncRepo) {
        const syncBranch = this.workspace.syncBranch || 'main';
        await this.git.push('origin', syncBranch);
      }
    } catch (error) {
      result.errors.push(`Push failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return result;
  }
  
  async pull(): Promise<SyncResult> {
    const result: SyncResult = {
      pulled: 0,
      pushed: 0,
      conflicts: 0,
      errors: [],
    };
    
    try {
      // Get current commit
      const currentCommit = await this.git.revparse(['HEAD']);
      
      // Pull from remote if configured
      if (this.workspace.syncRepo) {
        try {
          const syncBranch = this.workspace.syncBranch || 'main';
          await this.git.pull('origin', syncBranch);
        } catch (pullError) {
          // Handle merge conflicts
          const status = await this.git.status();
          if (status.conflicted.length > 0) {
            result.conflicts = status.conflicted.length;
            result.errors.push('Merge conflicts detected. Manual resolution required.');
            return result;
          }
          throw pullError;
        }
      }
      
      // Get new commit
      const newCommit = await this.git.revparse(['HEAD']);
      
      if (currentCommit !== newCommit) {
        // Process new changes
        const changes = await this.getChangesSince(currentCommit);
        result.pulled = changes.length;
        
        // Disable change tracking during sync to avoid infinite loops
        const changeTracker = ChangeTracker.getInstance();
        changeTracker.disable();
        
        try {
          // Apply changes to local database
          for (const change of changes) {
            await this.applyChange(change);
          }
        } finally {
          // Re-enable change tracking
          changeTracker.enable();
        }
      }
    } catch (error) {
      result.errors.push(`Pull failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return result;
  }
  
  async sync(): Promise<SyncResult> {
    // First pull, then push
    const pullResult = await this.pull();
    if (pullResult.errors.length > 0 || pullResult.conflicts > 0) {
      return pullResult;
    }
    
    const pushResult = await this.push();
    
    return {
      pulled: pullResult.pulled,
      pushed: pushResult.pushed,
      conflicts: pullResult.conflicts,
      errors: [...pullResult.errors, ...pushResult.errors],
    };
  }
  
  async exportWorkspaceData(): Promise<void> {
    const startMemory = process.memoryUsage().heapUsed;
    const memoryThreshold = 500 * 1024 * 1024; // 500MB threshold
    
    // Get all realms in this workspace
    const realms = this.db.getWorkspaceRealms(this.workspace.id);
    
    // Create export structure with metadata only
    const exportMetadata = {
      timestamp: new Date().toISOString(),
      workspace: this.workspace,
      realms: realms,
    };
    
    // Write metadata first
    this.writeJsonFile('state/export-metadata.json', exportMetadata);
    
    // Export lores by realm to avoid memory buildup
    const allLoreIds = new Set<string>();
    const loreExports: Lore[] = [];
    let chunkCount = 0;
    
    for (const realm of realms) {
      const lores = this.db.listLoresByRealm(realm.id);
      loreExports.push(...lores);
      lores.forEach(l => allLoreIds.add(l.id));
      
      // Check memory usage
      const currentMemory = process.memoryUsage().heapUsed;
      if (currentMemory - startMemory > memoryThreshold) {
        console.warn(`Memory usage high during export: ${Math.round((currentMemory - startMemory) / 1024 / 1024)}MB`);
      }
      
      // Write lores in chunks of 100 to avoid memory buildup
      if (loreExports.length >= 100) {
        const chunkFile = `state/lores-chunk-${chunkCount++}.json`;
        this.writeJsonFile(chunkFile, loreExports);
        loreExports.length = 0; // Clear array
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    }
    
    // Write remaining lores
    if (loreExports.length > 0) {
      const chunkFile = `state/lores-chunk-${chunkCount++}.json`;
      this.writeJsonFile(chunkFile, loreExports);
    }
    
    // Export relations more efficiently
    const relationExports: LoreRelation[] = [];
    const uniqueRelationKeys = new Set<string>();
    let relationChunkCount = 0;
    
    // Process relations in batches to avoid memory spikes
    const loreIdArray = Array.from(allLoreIds);
    const batchSize = 50; // Process 50 lores at a time
    
    for (let i = 0; i < loreIdArray.length; i += batchSize) {
      const batch = loreIdArray.slice(i, i + batchSize);
      
      for (const loreId of batch) {
        const relations = this.db.listRelationsByLore(loreId);
        
        for (const rel of relations) {
          // Only include relations where both lores are in our workspace
          if (allLoreIds.has(rel.fromLoreId) && allLoreIds.has(rel.toLoreId)) {
            const key = `${rel.fromLoreId}-${rel.toLoreId}-${rel.type}`;
            if (!uniqueRelationKeys.has(key)) {
              uniqueRelationKeys.add(key);
              relationExports.push(rel);
              
              // Write relations in chunks of 100
              if (relationExports.length >= 100) {
                const chunkFile = `state/relations-chunk-${relationChunkCount++}.json`;
                this.writeJsonFile(chunkFile, relationExports);
                relationExports.length = 0; // Clear array
              }
            }
          }
        }
      }
      
      // Check memory after each batch
      const currentMemory = process.memoryUsage().heapUsed;
      if (currentMemory - startMemory > memoryThreshold) {
        console.warn(`Memory usage high during relation export: ${Math.round((currentMemory - startMemory) / 1024 / 1024)}MB`);
        if (global.gc) {
          global.gc();
        }
      }
    }
    
    // Write remaining relations
    if (relationExports.length > 0) {
      const chunkFile = `state/relations-chunk-${relationChunkCount++}.json`;
      this.writeJsonFile(chunkFile, relationExports);
    }
    
    // Combine all chunks into final export
    this.combineExportChunks();
    
    const endMemory = process.memoryUsage().heapUsed;
    console.log(`Export completed. Memory used: ${Math.round((endMemory - startMemory) / 1024 / 1024)}MB`);
  }
  
  private combineExportChunks(): void {
    const stateDir = path.join(this.syncPath, 'state');
    
    // Read metadata
    const metadata = this.readJsonFile<any>('state/export-metadata.json');
    
    // Collect all lore chunks in order
    const loreChunks = readdirSync(stateDir)
      .filter(f => f.startsWith('lores-chunk-'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/lores-chunk-(\d+)\.json/)?.[1] || '0');
        const numB = parseInt(b.match(/lores-chunk-(\d+)\.json/)?.[1] || '0');
        return numA - numB;
      })
      .map(f => this.readJsonFile<Lore[]>(`state/${f}`))
      .flat();
    
    // Collect all relation chunks in order
    const relationChunks = readdirSync(stateDir)
      .filter(f => f.startsWith('relations-chunk-'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/relations-chunk-(\d+)\.json/)?.[1] || '0');
        const numB = parseInt(b.match(/relations-chunk-(\d+)\.json/)?.[1] || '0');
        return numA - numB;
      })
      .map(f => this.readJsonFile<LoreRelation[]>(`state/${f}`))
      .flat();
    
    // Create final export
    const finalExport = {
      ...metadata,
      lores: loreChunks,
      relations: relationChunks,
    };
    
    // Write final export
    this.writeJsonFile('state/current-export.json', finalExport);
    
    // Clean up chunk files
    readdirSync(stateDir)
      .filter(f => f.includes('-chunk-'))
      .forEach(f => unlinkSync(path.join(stateDir, f)));
    
    // Clean up metadata file
    unlinkSync(path.join(stateDir, 'export-metadata.json'));
  }
  
  private async getChangesSince(commit: string): Promise<ChangeEvent[]> {
    // Get list of changed files since commit
    const diff = await this.git.diff(['--name-only', commit, 'HEAD']);
    const changedFiles = diff.split('\n').filter(f => f.startsWith('changes/'));
    
    const changes: ChangeEvent[] = [];
    for (const file of changedFiles) {
      try {
        const change = this.readJsonFile<ChangeEvent>(file);
        if (change.deviceId !== this.deviceId) {
          changes.push(change);
        }
      } catch (error) {
        console.error(`Failed to read change file ${file}:`, error);
      }
    }
    
    // Sort by timestamp
    changes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    return changes;
  }
  
  private async applyChange(change: ChangeEvent): Promise<void> {
    switch (change.entity) {
      case 'lore':
        await this.applyLoreChange(change);
        break;
      case 'realm':
        await this.applyRealmChange(change);
        break;
      case 'relation':
        await this.applyRelationChange(change);
        break;
    }
  }
  
  private async applyLoreChange(change: ChangeEvent): Promise<void> {
    switch (change.operation) {
      case 'create':
        if (change.data && !this.db.findLore(change.entityId)) {
          await this.db.createLore(change.data as CreateLoreInput);
        }
        break;
        
      case 'update':
        if (change.data && this.db.findLore(change.entityId)) {
          await this.db.updateLore(change.entityId, change.data);
        }
        break;
        
      case 'delete':
        if (this.db.findLore(change.entityId)) {
          await this.db.deleteLore(change.entityId);
        }
        break;
        
      case 'archive':
        if (this.db.findLore(change.entityId)) {
          await this.db.softDeleteLore(change.entityId);
        }
        break;
    }
  }
  
  private async applyRealmChange(change: ChangeEvent): Promise<void> {
    switch (change.operation) {
      case 'create':
        if (change.data && !this.db.findRealm(change.entityId)) {
          this.db.createRealm(change.data as CreateRealmInput);
        }
        break;
        
      case 'update':
        // Realm updates not implemented yet
        break;
    }
  }
  
  private async applyRelationChange(change: ChangeEvent): Promise<void> {
    switch (change.operation) {
      case 'create':
        if (change.data) {
          const rel = change.data as CreateRelationInput;
          try {
            await this.db.createRelation(rel);
          } catch (error) {
            // Relation might already exist
          }
        }
        break;
        
      case 'delete':
        if (change.data) {
          const rel = change.data as { fromLoreId: string; toLoreId: string; type: string };
          await this.db.deleteRelation(rel.fromLoreId, rel.toLoreId, rel.type);
        }
        break;
    }
  }
  
  private getOrCreateDeviceId(): string {
    const deviceIdPath = join(homedir(), '.lorehub', 'device-id');
    
    if (existsSync(deviceIdPath)) {
      return readFileSync(deviceIdPath, 'utf-8').trim();
    }
    
    const deviceId = uuidv4();
    mkdirSync(dirname(deviceIdPath), { recursive: true });
    writeFileSync(deviceIdPath, deviceId);
    
    return deviceId;
  }
  
  private readJsonFile<T>(relativePath: string): T {
    const fullPath = join(this.syncPath, relativePath);
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  }
  
  private writeJsonFile(relativePath: string, data: any): void {
    const fullPath = join(this.syncPath, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, JSON.stringify(data, null, 2));
  }
}