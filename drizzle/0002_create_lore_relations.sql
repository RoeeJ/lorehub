CREATE TABLE "lore_relations" (
  "from_lore_id" text NOT NULL,
  "to_lore_id" text NOT NULL,
  "type" text NOT NULL,
  "strength" real DEFAULT 1.0 NOT NULL,
  "metadata" text,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY("from_lore_id", "to_lore_id", "type"),
  FOREIGN KEY ("from_lore_id") REFERENCES "lores"("id") ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY ("to_lore_id") REFERENCES "lores"("id") ON UPDATE no action ON DELETE cascade
);