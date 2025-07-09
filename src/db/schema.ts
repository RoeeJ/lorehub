import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Projects table
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  gitRemote: text('git_remote'),
  isMonorepo: integer('is_monorepo', { mode: 'boolean' }).notNull().default(false),
  services: text('services').notNull().default('[]'), // JSON array
  lastSeen: text('last_seen').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pathIdx: uniqueIndex('projects_path_unique').on(table.path),
}));

// Facts table
export const facts = sqliteTable('facts', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  why: text('why'),
  type: text('type').notNull(),
  services: text('services').notNull().default('[]'), // JSON array
  tags: text('tags').notNull().default('[]'), // JSON array
  confidence: integer('confidence').notNull().default(80),
  source: text('source').notNull(), // JSON object
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  projectIdIdx: index('idx_facts_project_id').on(table.projectId),
  typeIdx: index('idx_facts_type').on(table.type),
  statusIdx: index('idx_facts_status').on(table.status),
  contentIdx: index('idx_facts_content').on(table.content),
}));

// Relations table
export const relations = sqliteTable('relations', {
  fromFactId: text('from_fact_id').notNull().references(() => facts.id, { onDelete: 'cascade' }),
  toFactId: text('to_fact_id').notNull().references(() => facts.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  strength: real('strength').notNull().default(1.0),
  metadata: text('metadata'), // JSON object
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  pk: primaryKey({ columns: [table.fromFactId, table.toFactId, table.type] }),
  fromIdx: index('idx_relations_from').on(table.fromFactId),
  toIdx: index('idx_relations_to').on(table.toFactId),
}));

// Type exports for inference
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Fact = typeof facts.$inferSelect;
export type NewFact = typeof facts.$inferInsert;
export type Relation = typeof relations.$inferSelect;
export type NewRelation = typeof relations.$inferInsert;