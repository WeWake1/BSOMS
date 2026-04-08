-- ============================================================
-- Phase 08: Create order_items table for sub-order support
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create the table
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

-- 2. Auto-update updated_at on change
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

-- 3. Row Level Security
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Viewers: read only
CREATE POLICY "Viewers can read order_items"
  ON order_items FOR SELECT
  TO authenticated
  USING (true);

-- Admins: full CRUD (relies on profiles.role = 'admin')
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

-- 4. Enable Realtime for order_items (run in Supabase Dashboard → Database → Replication)
-- Or run:
-- ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
