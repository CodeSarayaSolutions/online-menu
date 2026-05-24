-- ============================================================
-- Saraya CMS — Role groups + product station (kitchen / bar)
-- ============================================================
-- Run after 004_custom_accounts.sql
-- ============================================================
--
-- Platform (users.platform_role):
--   admin  — Saraya company; all venues (/admin)
--
-- Restaurant workspace (restaurant_access.role):
--   owner   — full venue CMS + staff + all station views
--   manager — CMS + orders overview + all station views
--   kitchen — kitchen station only (/admin/[venue]/kitchen)
--   bar     — bar station only (/admin/[venue]/bar)
--   employee — legacy: orders list only (optional)
-- ============================================================

-- ─── Product station (which screen shows the item) ─────────
ALTER TABLE sarayamenu.products
  ADD COLUMN IF NOT EXISTS station TEXT NOT NULL DEFAULT 'kitchen'
  CHECK (station IN ('kitchen', 'bar', 'both'));

COMMENT ON COLUMN sarayamenu.products.station IS
  'kitchen = food prep screen; bar = drinks screen; both = appears on both.';

-- ─── Expand restaurant_access roles ────────────────────────
ALTER TABLE sarayamenu.restaurant_access
  DROP CONSTRAINT IF EXISTS restaurant_access_role_check;

ALTER TABLE sarayamenu.restaurant_access
  ADD CONSTRAINT restaurant_access_role_check
  CHECK (role IN ('owner', 'manager', 'kitchen', 'bar', 'employee'));

-- ─── RLS: station roles can read/update orders for their venue ─
CREATE OR REPLACE FUNCTION sarayamenu.has_restaurant_role(
  p_restaurant_id TEXT,
  p_role TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = sarayamenu, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sarayamenu.restaurant_access ra
    WHERE ra.user_id = sarayamenu.current_app_user_id()
      AND ra.restaurant_id = p_restaurant_id
      AND (
        p_role IS NULL
        OR ra.role = p_role
        OR (p_role = 'manager' AND ra.role IN ('owner', 'manager'))
        OR (p_role = 'owner' AND ra.role = 'owner')
      )
  ) OR sarayamenu.is_platform_admin();
$$;

CREATE OR REPLACE FUNCTION sarayamenu.can_access_station(
  p_restaurant_id TEXT,
  p_station TEXT
)
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = sarayamenu, public
AS $$
  SELECT sarayamenu.is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM sarayamenu.restaurant_access ra
    WHERE ra.user_id = sarayamenu.current_app_user_id()
      AND ra.restaurant_id = p_restaurant_id
      AND ra.role IN ('owner', 'manager', p_station)
  );
$$;

-- Orders: kitchen/bar staff can select and update status
DROP POLICY IF EXISTS "orders_select_staff" ON sarayamenu.orders;
CREATE POLICY "orders_select_staff"
  ON sarayamenu.orders FOR SELECT
  USING (
    sarayamenu.has_restaurant_role(restaurant_id)
    OR sarayamenu.can_access_station(restaurant_id, 'kitchen')
    OR sarayamenu.can_access_station(restaurant_id, 'bar')
  );

DROP POLICY IF EXISTS "orders_update_staff" ON sarayamenu.orders;
CREATE POLICY "orders_update_staff"
  ON sarayamenu.orders FOR UPDATE
  USING (
    sarayamenu.has_restaurant_role(restaurant_id, 'manager')
    OR sarayamenu.can_access_station(restaurant_id, 'kitchen')
    OR sarayamenu.can_access_station(restaurant_id, 'bar')
  );
