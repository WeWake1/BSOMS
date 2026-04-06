-- Add sort_order to order_items for drag-to-reorder
-- Run this in Supabase SQL Editor before using the sub-order form
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sort_order integer default 0;
