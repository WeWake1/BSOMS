-- Pricelist: optional free-text description per product variety.
-- Internal notes for the team (grade details, usage, sourcing remarks…).
-- Shown only inside the app (product detail sheet) — never printed on
-- quotes or on price lists shared with customers.
--
-- description lives on pricelist_nodes, which all authenticated users can
-- already SELECT, so no new RLS is needed.

alter table pricelist_nodes
  add column if not exists description text;

comment on column pricelist_nodes.description is
  'Optional internal description for a product variety (in-app only, never customer-facing).';
