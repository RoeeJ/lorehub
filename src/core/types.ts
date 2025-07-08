import { z } from 'zod';

// Fact types
export const FactTypeSchema = z.enum([
  'decision',
  'assumption',
  'constraint',
  'requirement',
  'risk',
  'learning',
  'todo',
  'other'
]);

export const FactStatusSchema = z.enum(['active', 'superseded', 'deprecated']);

export const SourceTypeSchema = z.enum(['manual', 'inferred', 'imported']);

export const SourceSchema = z.object({
  type: SourceTypeSchema,
  reference: z.string(),
  context: z.string().optional(),
});

export const FactSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  content: z.string(),
  why: z.string().optional(),
  type: FactTypeSchema,
  services: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(100).default(80),
  source: SourceSchema,
  status: FactStatusSchema.default('active'),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Relation types
export const RelationTypeSchema = z.enum([
  'supersedes',
  'contradicts',
  'supports',
  'depends_on',
  'relates_to'
]);

export const RelationSchema = z.object({
  fromFactId: z.string(),
  toFactId: z.string(),
  type: RelationTypeSchema,
  strength: z.number().min(0).max(1).default(1.0),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date().default(() => new Date()),
}).refine(data => data.fromFactId !== data.toFactId, {
  message: "A fact cannot have a relation to itself"
});

// Project types
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string().min(1),
  gitRemote: z.string().url().optional(),
  isMonorepo: z.boolean().default(false),
  services: z.array(z.string()).default([]),
  lastSeen: z.date().default(() => new Date()),
  createdAt: z.date().default(() => new Date()),
});

// Type exports
export type FactType = z.infer<typeof FactTypeSchema>;
export type FactStatus = z.infer<typeof FactStatusSchema>;
export type SourceType = z.infer<typeof SourceTypeSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Fact = z.infer<typeof FactSchema>;
export type RelationType = z.infer<typeof RelationTypeSchema>;
export type Relation = z.infer<typeof RelationSchema>;
export type Project = z.infer<typeof ProjectSchema>;

// Type guards
export const isFact = (value: unknown): value is Fact => {
  return FactSchema.safeParse(value).success;
};

export const isRelation = (value: unknown): value is Relation => {
  return RelationSchema.safeParse(value).success;
};

export const isProject = (value: unknown): value is Project => {
  return ProjectSchema.safeParse(value).success;
};

// Utility types
export type FactId = Fact['id'];
export type ProjectId = Project['id'];

export type CreateFactInput = {
  projectId: string;
  content: string;
  type: FactType;
  source: Source;
  why?: string;
  services?: string[];
  tags?: string[];
  confidence?: number;
  status?: FactStatus;
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateFactInput = Partial<Omit<Fact, 'id' | 'projectId' | 'createdAt'>>;

export type CreateRelationInput = {
  fromFactId: string;
  toFactId: string;
  type: RelationType;
  strength?: number;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

export type CreateProjectInput = {
  name: string;
  path: string;
  gitRemote?: string;
  isMonorepo?: boolean;
  services?: string[];
  id?: string;
  createdAt?: Date;
  lastSeen?: Date;
};

// Performance-focused validation helpers
export const validateFact = (fact: unknown): Fact => {
  return FactSchema.parse(fact);
};

export const validateFactSafe = (fact: unknown) => {
  return FactSchema.safeParse(fact);
};

export const validateRelation = (relation: unknown): Relation => {
  return RelationSchema.parse(relation);
};

export const validateRelationSafe = (relation: unknown) => {
  return RelationSchema.safeParse(relation);
};

export const validateProject = (project: unknown): Project => {
  return ProjectSchema.parse(project);
};

export const validateProjectSafe = (project: unknown) => {
  return ProjectSchema.safeParse(project);
};