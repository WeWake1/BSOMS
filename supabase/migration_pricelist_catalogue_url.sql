-- Pricelist: optional external catalogue / designs link per product variety.
-- Lets the owner attach a Google Drive (or any) URL to a variety — a catalogue
-- or designs folder — that staff can open from the product detail sheet.
--
-- catalogue_url lives on pricelist_nodes, which all authenticated users can
-- already SELECT, so no new RLS is needed. Applied live 2026-07-18.

alter table pricelist_nodes
  add column if not exists catalogue_url text;

comment on column pricelist_nodes.catalogue_url is
  'Optional external link (e.g. Google Drive catalogue / designs) for a product variety.';
