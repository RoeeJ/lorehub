CREATE TABLE "lores" (
  "id" text PRIMARY KEY NOT NULL,
  "realm_id" text NOT NULL,
  "content" text NOT NULL,
  "why" text,
  "type" text NOT NULL,
  "provinces" text DEFAULT '[]' NOT NULL,
  "sigils" text DEFAULT '[]' NOT NULL,
  "confidence" integer DEFAULT 80 NOT NULL,
  "origin" text NOT NULL,
  "status" text DEFAULT 'living' NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON UPDATE no action ON DELETE cascade
);