-- Add mobile_no column to orders.
-- Stored as 10-digit string (no country code, no spaces). NULL when not collected.
-- All numbers are assumed Indian (+91 prefix applied at link-build time).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS mobile_no text NULL;

-- Optional sanity constraint: when set, must be exactly 10 digits.
ALTER TABLE orders
  ADD CONSTRAINT orders_mobile_no_format
  CHECK (mobile_no IS NULL OR mobile_no ~ '^[0-9]{10}$');

-- Helpful index for autocomplete lookups by customer_name (case-insensitive).
CREATE INDEX IF NOT EXISTS idx_orders_customer_name_lower
  ON orders ((lower(customer_name)));
