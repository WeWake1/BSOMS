-- =============================================================
-- ROLLBACK MIGRATION: Sub-Orders (Revert to original state)
-- Run this ENTIRE script in Supabase SQL Editor (Dashboard → SQL)
-- =============================================================

-- Step 1: Add the removed columns back to the 'orders' table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS due_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS dispatch_date date,
  ADD COLUMN IF NOT EXISTS length numeric,
  ADD COLUMN IF NOT EXISTS width numeric,
  ADD COLUMN IF NOT EXISTS qty integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS status order_status NOT NULL DEFAULT 'Pending';

-- Step 2: Stop tracking 'order_items' in Supabase Realtime
-- Use a DO block to safely drop the table from publication if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE order_items;
  END IF;
END $$;

-- Step 3: Drop the 'order_items' table completely
DROP TABLE IF EXISTS order_items CASCADE;
