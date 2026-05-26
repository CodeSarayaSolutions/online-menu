-- RLS policies for happy hour + inventory audit tables.
-- Run this after happy-hour-and-inventory-tracking.sql succeeds.

GRANT USAGE ON SCHEMA sarayamenu TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON sarayamenu.happy_hour_schedules
  TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON sarayamenu.happy_hour_products
  TO anon, authenticated;

GRANT SELECT, INSERT
  ON sarayamenu.inventory_audit_log
  TO anon, authenticated;

ALTER TABLE sarayamenu.happy_hour_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.happy_hour_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.inventory_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS happy_hour_schedules_public_select
  ON sarayamenu.happy_hour_schedules;

CREATE POLICY happy_hour_schedules_public_select
  ON sarayamenu.happy_hour_schedules
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS happy_hour_products_public_select
  ON sarayamenu.happy_hour_products;

CREATE POLICY happy_hour_products_public_select
  ON sarayamenu.happy_hour_products
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS happy_hour_schedules_admin_insert
  ON sarayamenu.happy_hour_schedules;

CREATE POLICY happy_hour_schedules_admin_insert
  ON sarayamenu.happy_hour_schedules
  FOR INSERT
  WITH CHECK (
    sarayamenu.is_platform_admin()
    OR sarayamenu.has_restaurant_role(restaurant_id, 'owner')
    OR sarayamenu.has_restaurant_role(restaurant_id, 'manager')
  );

DROP POLICY IF EXISTS happy_hour_schedules_admin_update
  ON sarayamenu.happy_hour_schedules;

CREATE POLICY happy_hour_schedules_admin_update
  ON sarayamenu.happy_hour_schedules
  FOR UPDATE
  USING (
    sarayamenu.is_platform_admin()
    OR sarayamenu.has_restaurant_role(restaurant_id, 'owner')
    OR sarayamenu.has_restaurant_role(restaurant_id, 'manager')
  )
  WITH CHECK (
    sarayamenu.is_platform_admin()
    OR sarayamenu.has_restaurant_role(restaurant_id, 'owner')
    OR sarayamenu.has_restaurant_role(restaurant_id, 'manager')
  );

DROP POLICY IF EXISTS happy_hour_schedules_admin_delete
  ON sarayamenu.happy_hour_schedules;

CREATE POLICY happy_hour_schedules_admin_delete
  ON sarayamenu.happy_hour_schedules
  FOR DELETE
  USING (
    sarayamenu.is_platform_admin()
    OR sarayamenu.has_restaurant_role(restaurant_id, 'owner')
    OR sarayamenu.has_restaurant_role(restaurant_id, 'manager')
  );

DROP POLICY IF EXISTS happy_hour_products_admin_insert
  ON sarayamenu.happy_hour_products;

CREATE POLICY happy_hour_products_admin_insert
  ON sarayamenu.happy_hour_products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM sarayamenu.happy_hour_schedules s
      JOIN sarayamenu.products p ON p.id = product_id
      WHERE s.id = schedule_id
        AND p.restaurant_id = s.restaurant_id
        AND (
          sarayamenu.is_platform_admin()
          OR sarayamenu.has_restaurant_role(s.restaurant_id, 'owner')
          OR sarayamenu.has_restaurant_role(s.restaurant_id, 'manager')
        )
    )
  );

DROP POLICY IF EXISTS happy_hour_products_admin_update
  ON sarayamenu.happy_hour_products;

CREATE POLICY happy_hour_products_admin_update
  ON sarayamenu.happy_hour_products
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM sarayamenu.happy_hour_schedules s
      WHERE s.id = schedule_id
        AND (
          sarayamenu.is_platform_admin()
          OR sarayamenu.has_restaurant_role(s.restaurant_id, 'owner')
          OR sarayamenu.has_restaurant_role(s.restaurant_id, 'manager')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM sarayamenu.happy_hour_schedules s
      JOIN sarayamenu.products p ON p.id = product_id
      WHERE s.id = schedule_id
        AND p.restaurant_id = s.restaurant_id
        AND (
          sarayamenu.is_platform_admin()
          OR sarayamenu.has_restaurant_role(s.restaurant_id, 'owner')
          OR sarayamenu.has_restaurant_role(s.restaurant_id, 'manager')
        )
    )
  );

DROP POLICY IF EXISTS happy_hour_products_admin_delete
  ON sarayamenu.happy_hour_products;

CREATE POLICY happy_hour_products_admin_delete
  ON sarayamenu.happy_hour_products
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM sarayamenu.happy_hour_schedules s
      WHERE s.id = schedule_id
        AND (
          sarayamenu.is_platform_admin()
          OR sarayamenu.has_restaurant_role(s.restaurant_id, 'owner')
          OR sarayamenu.has_restaurant_role(s.restaurant_id, 'manager')
        )
    )
  );

DROP POLICY IF EXISTS inventory_audit_log_admin_select
  ON sarayamenu.inventory_audit_log;

CREATE POLICY inventory_audit_log_admin_select
  ON sarayamenu.inventory_audit_log
  FOR SELECT
  USING (
    sarayamenu.is_platform_admin()
    OR sarayamenu.has_restaurant_role(restaurant_id, 'owner')
    OR sarayamenu.has_restaurant_role(restaurant_id, 'manager')
  );

DROP POLICY IF EXISTS inventory_audit_log_admin_insert
  ON sarayamenu.inventory_audit_log;

CREATE POLICY inventory_audit_log_admin_insert
  ON sarayamenu.inventory_audit_log
  FOR INSERT
  WITH CHECK (
    sarayamenu.is_platform_admin()
    OR sarayamenu.has_restaurant_role(restaurant_id, 'owner')
    OR sarayamenu.has_restaurant_role(restaurant_id, 'manager')
  );

NOTIFY pgrst, 'reload schema';
