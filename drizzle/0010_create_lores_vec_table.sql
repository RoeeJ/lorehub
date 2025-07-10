CREATE VIRTUAL TABLE lores_vec USING vec0(
  lore_id text PRIMARY KEY,
  embedding float[768]
);