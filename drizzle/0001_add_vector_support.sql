-- Add vector support using sqlite-vec
-- This creates a virtual table for storing fact embeddings
CREATE VIRTUAL TABLE IF NOT EXISTS facts_vec USING vec0(
    fact_id TEXT PRIMARY KEY,
    embedding FLOAT[384]
);
--> statement-breakpoint
-- Add embedding_generated column to track which facts have embeddings
ALTER TABLE facts ADD COLUMN embedding_generated INTEGER DEFAULT 0;
--> statement-breakpoint
-- Create index on embedding_generated for efficient querying
CREATE INDEX IF NOT EXISTS idx_facts_embedding_generated ON facts(embedding_generated);