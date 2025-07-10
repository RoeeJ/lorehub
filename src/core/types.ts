import { z } from 'zod';

// Lore types
export const LoreTypeSchema = z.enum([
  'decree',      // Architectural or technical choice (was 'decision')
  'wisdom',      // Something discovered or learned (was 'learning')
  'belief',      // Unverified belief or hypothesis (was 'assumption')
  'constraint',  // Limitation or restriction
  'requirement', // Business or technical requirement
  'risk',        // Potential problem or concern
  'quest',       // Future action needed (was 'todo')
  'saga',        // Major initiative (was 'epic')
  'story',       // User story
  'anomaly',     // Bug or issue
  'other'        // Miscellaneous lore
]);

export const LoreStatusSchema = z.enum([
  'living',      // Current operating knowledge (was 'active')
  'ancient',     // Outdated but historically important (was 'deprecated')
  'whispered',   // Unconfirmed lore (was 'draft')
  'proclaimed',  // Verified lore (was 'confirmed')
  'archived'     // Soft deleted
]);

export const OriginTypeSchema = z.enum(['manual', 'inferred', 'imported']);

export const OriginSchema = z.object({
  type: OriginTypeSchema,
  reference: z.string(),
  context: z.string().optional(),
});

export const LoreSchema = z.object({
  id: z.string(),
  realmId: z.string(),  // was realmId
  content: z.string(),
  why: z.string().optional(),
  type: LoreTypeSchema,
  provinces: z.array(z.string()).default([]),  // Services in monorepo (was 'provinces')
  sigils: z.array(z.string()).default([]),     // Tags (was 'tags')
  confidence: z.number().min(0).max(100).default(80),
  origin: OriginSchema,
  status: LoreStatusSchema.default('living'),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Relation types
export const RelationTypeSchema = z.enum([
  'succeeds',    // Supersedes (was 'supersedes')
  'challenges',  // Contradicts (was 'contradicts')
  'supports',    // Supports
  'depends_on',  // Depends on
  'bound_to'     // Related to (was 'relates_to')
]);

export const RelationSchema = z.object({
  fromLoreId: z.string(),
  toLoreId: z.string(),
  type: RelationTypeSchema,
  strength: z.number().min(0).max(1).default(1.0),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date().default(() => new Date()),
}).refine(data => data.fromLoreId !== data.toLoreId, {
  message: "A lore cannot have a relation to itself"
});

// Realm types (was Realm)
export const RealmSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string().min(1),
  gitRemote: z.string().url().optional(),
  isMonorepo: z.boolean().default(false),
  provinces: z.array(z.string()).default([]),
  lastSeen: z.date().default(() => new Date()),
  createdAt: z.date().default(() => new Date()),
});

// Type exports
export type LoreType = z.infer<typeof LoreTypeSchema>;
export type LoreStatus = z.infer<typeof LoreStatusSchema>;
export type OriginType = z.infer<typeof OriginTypeSchema>;
export type Origin = z.infer<typeof OriginSchema>;
export type Lore = z.infer<typeof LoreSchema>;
export type RelationType = z.infer<typeof RelationTypeSchema>;
export type Relation = z.infer<typeof RelationSchema>;
export type LoreRelation = Relation;  // New name alias
export type Realm = z.infer<typeof RealmSchema>;


// Type guards
export const isLore = (value: unknown): value is Lore => {
  return LoreSchema.safeParse(value).success;
};

export const isRelation = (value: unknown): value is Relation => {
  return RelationSchema.safeParse(value).success;
};

export const isRealm = (value: unknown): value is Realm => {
  return RealmSchema.safeParse(value).success;
};


// Utility types
export type LoreId = Lore['id'];
export type RealmId = Realm['id'];

export type CreateLoreInput = {
  realmId: string;
  content: string;
  type: LoreType;
  origin: Origin;
  why?: string;
  provinces?: string[];
  sigils?: string[];
  confidence?: number;
  status?: LoreStatus;
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateLoreInput = Partial<Omit<Lore, 'id' | 'realmId' | 'createdAt'>>;


export type CreateRelationInput = {
  fromLoreId: string;
  toLoreId: string;
  type: RelationType;
  strength?: number;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

export type CreateRealmInput = {
  name: string;
  path: string;
  gitRemote?: string;
  isMonorepo?: boolean;
  provinces?: string[];
  id?: string;
  createdAt?: Date;
  lastSeen?: Date;
};


// Performance-focused validation helpers
export const validateLore = (lore: unknown): Lore => {
  return LoreSchema.parse(lore);
};

export const validateLoreSafe = (lore: unknown) => {
  return LoreSchema.safeParse(lore);
};

export const validateRelation = (relation: unknown): Relation => {
  return RelationSchema.parse(relation);
};

export const validateRelationSafe = (relation: unknown) => {
  return RelationSchema.safeParse(relation);
};

export const validateRealm = (realm: unknown): Realm => {
  return RealmSchema.parse(realm);
};

export const validateRealmSafe = (realm: unknown) => {
  return RealmSchema.safeParse(realm);
};

