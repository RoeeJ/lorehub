import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Realms table (formerly realms)
export const realms = sqliteTable(
  'realms',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    path: text('path').notNull().unique(),
    gitRemote: text('git_remote'),
    isMonorepo: integer('is_monorepo', { mode: 'boolean' })
      .notNull()
      .default(false),
    provinces: text('provinces').notNull().default('[]'), // JSON array
    lastSeen: text('last_seen')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pathIdx: uniqueIndex('realms_path_unique').on(table.path),
  })
);

export const lores = sqliteTable(
  'lores',
  {
    id: text('id').primaryKey(),
    realmId: text('realm_id')
      .notNull()
      .references(() => realms.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    why: text('why'),
    type: text('type').notNull(),
    provinces: text('provinces').notNull().default('[]'), // JSON array
    sigils: text('sigils').notNull().default('[]'), // JSON array
    confidence: integer('confidence').notNull().default(80),
    origin: text('origin').notNull(), // JSON object
    status: text('status').notNull().default('living'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_lores_realm_id').on(table.realmId),
    index('idx_lores_type').on(table.type),
    index('idx_lores_status').on(table.status),
    index('idx_lores_content').on(table.content),
  ]
);

// Lore relations table (formerly relations)
export const loreRelations = sqliteTable(
  'lore_relations',
  {
    fromLoreId: text('from_lore_id')
      .notNull()
      .references(() => lores.id, { onDelete: 'cascade' }),
    toLoreId: text('to_lore_id')
      .notNull()
      .references(() => lores.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    strength: real('strength').notNull().default(1.0),
    metadata: text('metadata'), // JSON object
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.fromLoreId, table.toLoreId, table.type] }),
    index('idx_lore_relations_from').on(table.fromLoreId),
    index('idx_lore_relations_to').on(table.toLoreId),
  ]
);

// Workspaces table
export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    syncEnabled: integer('sync_enabled', { mode: 'boolean' })
      .notNull()
      .default(false),
    syncRepo: text('sync_repo'), // Git remote URL
    syncBranch: text('sync_branch').default('main'),
    autoSync: integer('auto_sync', { mode: 'boolean' })
      .notNull()
      .default(true),
    syncInterval: integer('sync_interval').default(300), // seconds
    filters: text('filters'), // JSON object with sync filters
    isDefault: integer('is_default', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    nameIdx: uniqueIndex('workspaces_name_unique').on(table.name),
  })
);

// Update realms table to add workspace association
export const realmWorkspaces = sqliteTable(
  'realm_workspaces',
  {
    realmId: text('realm_id')
      .notNull()
      .references(() => realms.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.realmId, table.workspaceId] }),
    realmIdx: index('idx_realm_workspaces_realm').on(table.realmId),
    workspaceIdx: index('idx_realm_workspaces_workspace').on(table.workspaceId),
  })
);

// Sync state tracking
export const syncState = sqliteTable(
  'sync_state',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(),
    lastSyncAt: text('last_sync_at'),
    lastSyncCommit: text('last_sync_commit'),
    vectorClock: text('vector_clock'), // JSON object
    pendingChanges: integer('pending_changes').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.deviceId] }),
    workspaceIdx: index('idx_sync_state_workspace').on(table.workspaceId),
  })
);

// Type exports for inference
export type Realm = typeof realms.$inferSelect;
export type NewRealm = typeof realms.$inferInsert;
export type Lore = typeof lores.$inferSelect;
export type NewLore = typeof lores.$inferInsert;
export type LoreRelation = typeof loreRelations.$inferSelect;
export type NewLoreRelation = typeof loreRelations.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type RealmWorkspace = typeof realmWorkspaces.$inferSelect;
export type NewRealmWorkspace = typeof realmWorkspaces.$inferInsert;
export type SyncState = typeof syncState.$inferSelect;
export type NewSyncState = typeof syncState.$inferInsert;

// Export schema types for Drizzle
export type DbRealm = Realm;
export type DbLore = Lore;
export type DbLoreRelation = LoreRelation;
export type DbWorkspace = Workspace;
export type DbRealmWorkspace = RealmWorkspace;
export type DbSyncState = SyncState;
