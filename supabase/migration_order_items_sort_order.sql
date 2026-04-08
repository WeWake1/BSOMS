-- ============================================================
-- Phase 08: order_items table — idempotent migration
-- Safe to run multiple times. Run in Supabase SQL Editor.
-- ============================================================

-- 1. Create table if it doesn't already exist
CREATE TABLE IF NOT EXISTS order_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  category_id    uuid REFERENCES categories(id) ON DELETE SET NULL,
  item_label     text NOT NULL DEFAULT 'Item',
  date           date NOT NULL,
  due_date       date NOT NULL,
  dispatch_date  date,
  length         numeric,
  width          numeric,
  qty            integer NOT NULL DEFAULT 1,
  status         text NOT NULL DEFAULT 'Pending'
                   CHECK (status IN ('Pending','In Progress','Packing','Dispatched')),
  description    text,
  photo_url      text,
  audio_url      text,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 2. Add missing columns to existing table (safe if already present)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS audio_url text;

-- 3. Auto-update updated_at on change
CREATE OR REPLACE FUNCTION update_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_order_items_updated_at ON order_items;
CREATE TRIGGER set_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_order_items_updated_at();

-- 4. Row Level Security (enable is idempotent)
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 5. Policies — drop first so re-running is safe
DROP POLICY IF EXISTS "Viewers can read order_items" ON order_items;
DROP POLICY IF EXISTS "Admins can insert order_items" ON order_items;
DROP POLICY IF EXISTS "Admins can update order_items" ON order_items;
DROP POLICY IF EXISTS "Admins can delete order_items" ON order_items;

CREATE POLICY "Viewers can read order_items"
  ON order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert order_items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update order_items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete order_items"
  ON order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
