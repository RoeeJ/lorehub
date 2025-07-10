CREATE TABLE "realms" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "path" text NOT NULL,
  "git_remote" text,
  "is_monorepo" integer DEFAULT false NOT NULL,
  "provinces" text DEFAULT '[]' NOT NULL,
  "last_seen" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);