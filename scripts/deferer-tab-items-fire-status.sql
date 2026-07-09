-- DEFERER P0 migration.
-- Run manually in the Supabase SQL editor for schema sarayamenu before using
-- the waiter backlog feature in production.

ALTER TABLE sarayamenu.tab_items
  ADD COLUMN IF NOT EXISTS fire_status text NOT NULL DEFAULT 'fired'
    CHECK (fire_status IN ('backlog','fired')),
  ADD COLUMN IF NOT EXISTS fired_at timestamptz DEFAULT now();

-- Legacy rows are fired by default, so existing behavior stays unchanged.
UPDATE sarayamenu.tab_items
SET fired_at = COALESCE(fired_at, created_at, now())
WHERE fire_status = 'fired';

CREATE INDEX IF NOT EXISTS tab_items_fire_status_idx
  ON sarayamenu.tab_items (tab_id, fire_status);
