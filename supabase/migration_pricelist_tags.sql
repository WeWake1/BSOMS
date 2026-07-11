-- ════════════════════════════════════════════════════════════════════════
-- migration_pricelist_tags.sql
--
-- Adds a `tags` array to pricelist_nodes so products can carry quick visual
-- badges (e.g. 'Waterproof', 'Semi-WP', 'ISI') instead of nesting them as
-- folders. Display + search use these. RLS / grants / realtime already cover
-- the table from migration_pricelist.sql, so nothing else is needed.
-- ════════════════════════════════════════════════════════════════════════

alter table pricelist_nodes
  add column if not exists tags text[] not null default '{}';
