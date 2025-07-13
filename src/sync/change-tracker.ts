import { GitSyncAdapter } from './git-sync-adapter.js';
import type { ChangeEvent } from './git-sync-adapter.js';
import type { Workspace } from '../core/types.js';
import type { Database } from '../db/database.js';

export class ChangeTracker {
  private static instance: ChangeTracker | null = null;
  private syncAdapters: Map<string, GitSyncAdapter> = new Map();
  private enabled: boolean = false;
  private db: Database | null = null;

  private constructor() {}

  static getInstance(): ChangeTracker {
    if (!ChangeTracker.instance) {
      ChangeTracker.instance = new ChangeTracker();
    }
    return ChangeTracker.instance;
  }

  initialize(db: Database): void {
    this.db = db;
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  enable(): void {
    this.enabled = true;
  }

  async recordChange(
    change: Omit<ChangeEvent, 'id' | 'timestamp' | 'deviceId'>,
    realmId?: string
  ): Promise<void> {
    if (!this.enabled || !this.db) return;

    try {
      // Get workspaces associated with this realm (if realmId provided)
      let workspaces: Workspace[] = [];
      
      if (realmId) {
        workspaces = this.db.getRealmWorkspaces(realmId);
      } else if (change.metadata?.workspaceId) {
        const workspace = this.db.findWorkspace(change.metadata.workspaceId);
        if (workspace) workspaces = [workspace];
      }

      // If no workspaces found, try default workspace
      if (workspaces.length === 0) {
        const defaultWorkspace = this.db.getDefaultWorkspace();
        if (defaultWorkspace) workspaces = [defaultWorkspace];
      }

      // Record change in each workspace that has sync enabled
      for (const workspace of workspaces) {
        if (!workspace.syncEnabled) continue;

        // Get or create sync adapter for this workspace
        let adapter = this.syncAdapters.get(workspace.id);
        if (!adapter) {
          adapter = new GitSyncAdapter(workspace, this.db);
          await adapter.initialize();
          this.syncAdapters.set(workspace.id, adapter);
        }

        // Record the change
        await adapter.recordChange({
          ...change,
          metadata: {
            ...change.metadata,
            workspaceId: workspace.id,
            realmId
          }
        });

        // If auto-sync is enabled and we have a remote, push immediately
        if (workspace.autoSync && workspace.syncRepo) {
          // Don't await this - let it happen in the background
          adapter.push().catch(err => {
            console.error(`Auto-sync failed for workspace ${workspace.name}:`, err);
          });
        }
      }
    } catch (error) {
      console.error('Failed to record change:', error);
      // Don't throw - we don't want change tracking to break operations
    }
  }

  // Helper methods for specific entity types
  async recordLoreChange(
    operation: ChangeEvent['operation'],
    loreId: string,
    realmId: string,
    data?: any
  ): Promise<void> {
    await this.recordChange({
      operation,
      entity: 'lore',
      entityId: loreId,
      data,
      metadata: { realmId }
    }, realmId);
  }

  async recordRealmChange(
    operation: ChangeEvent['operation'],
    realmId: string,
    data?: any
  ): Promise<void> {
    await this.recordChange({
      operation,
      entity: 'realm',
      entityId: realmId,
      data
    }, realmId);
  }

  async recordRelationChange(
    operation: ChangeEvent['operation'],
    fromLoreId: string,
    toLoreId: string,
    type: string,
    realmId: string,
    data?: any
  ): Promise<void> {
    await this.recordChange({
      operation,
      entity: 'relation',
      entityId: `${fromLoreId}-${toLoreId}-${type}`,
      data: data || { fromLoreId, toLoreId, type },
      metadata: { realmId }
    }, realmId);
  }

  // Clean up sync adapters
  async cleanup(): Promise<void> {
    this.syncAdapters.clear();
  }
}