-- ============================================================
-- Saraya CMS — schema `sarayamenu`: RLS + API grants
-- ============================================================
-- Run after 001_create_schema_and_tables.sql
-- ============================================================

ALTER TABLE sarayamenu.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.restaurants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.restaurant_access    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.addons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.variations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.variation_options    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.page_content         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.component_styles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.layout_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.theme_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.sessions             ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON sarayamenu.sessions FROM anon, authenticated;
GRANT ALL ON sarayamenu.sessions TO service_role;

-- ─────────────────────────────────────────────────────────────
-- Helper functions (app sessions — NOT Supabase Auth / auth.uid)
-- Requires 004_custom_accounts.sql header helpers if running 002 alone on old DB.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sarayamenu.request_header(header_name text)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.headers', true), '')::json ->> lower(header_name),
    NULLIF(current_setting('request.headers', true), '')::json ->> header_name
  );
$$;

CREATE OR REPLACE FUNCTION sarayamenu.session_token_hash()
RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN sarayamenu.request_header('x-sarayamenu-session') IS NULL
      OR sarayamenu.request_header('x-sarayamenu-session') = ''
    THEN NULL
    ELSE encode(sha256(sarayamenu.request_header('x-sarayamenu-session')::bytea), 'hex')
  END;
$$;

CREATE OR REPLACE FUNCTION sarayamenu.current_app_user_id()
RETURNS UUID
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = sarayamenu, public
AS $$
  SELECT s.user_id
  FROM sarayamenu.sessions s
  WHERE s.expires_at > NOW()
    AND s.token_hash = sarayamenu.session_token_hash()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION sarayamenu.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = sarayamenu, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sarayamenu.users
    WHERE id = sarayamenu.current_app_user_id()
      AND platform_role = 'admin'
  );
$$;

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
      AND (p_role IS NULL OR ra.role = p_role)
  ) OR sarayamenu.is_platform_admin();
$$;

-- ═══════════════════════════════════════════════════════════
-- RESTAURANTS
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "restaurants_select_public"
  ON sarayamenu.restaurants FOR SELECT
  USING (true);

CREATE POLICY "restaurants_insert_admin"
  ON sarayamenu.restaurants FOR INSERT
  WITH CHECK (sarayamenu.is_platform_admin());

CREATE POLICY "restaurants_update_manager"
  ON sarayamenu.restaurants FOR UPDATE
  USING (sarayamenu.has_restaurant_role(id, 'manager'));

CREATE POLICY "restaurants_delete_admin"
  ON sarayamenu.restaurants FOR DELETE
  USING (sarayamenu.is_platform_admin());

-- ═══════════════════════════════════════════════════════════
-- CATEGORIES
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "categories_select_public"
  ON sarayamenu.categories FOR SELECT
  USING (true);

CREATE POLICY "categories_insert_manager"
  ON sarayamenu.categories FOR INSERT
  WITH CHECK (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

CREATE POLICY "categories_update_manager"
  ON sarayamenu.categories FOR UPDATE
  USING (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

CREATE POLICY "categories_delete_manager"
  ON sarayamenu.categories FOR DELETE
  USING (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

-- ═══════════════════════════════════════════════════════════
-- PRODUCTS
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "products_select_public"
  ON sarayamenu.products FOR SELECT
  USING (true);

CREATE POLICY "products_insert_manager"
  ON sarayamenu.products FOR INSERT
  WITH CHECK (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

CREATE POLICY "products_update_manager"
  ON sarayamenu.products FOR UPDATE
  USING (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

CREATE POLICY "products_delete_manager"
  ON sarayamenu.products FOR DELETE
  USING (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

-- ═══════════════════════════════════════════════════════════
-- ADDONS
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "addons_select_public"
  ON sarayamenu.addons FOR SELECT
  USING (true);

CREATE POLICY "addons_insert_manager"
  ON sarayamenu.addons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sarayamenu.products p
      WHERE p.id = product_id
        AND sarayamenu.has_restaurant_role(p.restaurant_id, 'manager')
    )
  );

CREATE POLICY "addons_update_manager"
  ON sarayamenu.addons FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sarayamenu.products p
      WHERE p.id = product_id
        AND sarayamenu.has_restaurant_role(p.restaurant_id, 'manager')
    )
  );

CREATE POLICY "addons_delete_manager"
  ON sarayamenu.addons FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sarayamenu.products p
      WHERE p.id = product_id
        AND sarayamenu.has_restaurant_role(p.restaurant_id, 'manager')
    )
  );

-- ═══════════════════════════════════════════════════════════
-- VARIATIONS & OPTIONS
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "variations_select_public"
  ON sarayamenu.variations FOR SELECT
  USING (true);

CREATE POLICY "variations_insert_manager"
  ON sarayamenu.variations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sarayamenu.products p
      WHERE p.id = product_id
        AND sarayamenu.has_restaurant_role(p.restaurant_id, 'manager')
    )
  );

CREATE POLICY "variations_update_manager"
  ON sarayamenu.variations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sarayamenu.products p
      WHERE p.id = product_id
        AND sarayamenu.has_restaurant_role(p.restaurant_id, 'manager')
    )
  );

CREATE POLICY "variations_delete_manager"
  ON sarayamenu.variations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sarayamenu.products p
      WHERE p.id = product_id
        AND sarayamenu.has_restaurant_role(p.restaurant_id, 'manager')
    )
  );

CREATE POLICY "variation_options_select_public"
  ON sarayamenu.variation_options FOR SELECT
  USING (true);

CREATE POLICY "variation_options_insert_manager"
  ON sarayamenu.variation_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sarayamenu.variations v
      JOIN sarayamenu.products p ON p.id = v.product_id
      WHERE v.id = variation_id
        AND sarayamenu.has_restaurant_role(p.restaurant_id, 'manager')
    )
  );

CREATE POLICY "variation_options_update_manager"
  ON sarayamenu.variation_options FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sarayamenu.variations v
      JOIN sarayamenu.products p ON p.id = v.product_id
      WHERE v.id = variation_id
        AND sarayamenu.has_restaurant_role(p.restaurant_id, 'manager')
    )
  );

CREATE POLICY "variation_options_delete_manager"
  ON sarayamenu.variation_options FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sarayamenu.variations v
      JOIN sarayamenu.products p ON p.id = v.product_id
      WHERE v.id = variation_id
        AND sarayamenu.has_restaurant_role(p.restaurant_id, 'manager')
    )
  );

-- ═══════════════════════════════════════════════════════════
-- PAGE CONTENT / COMPONENT STYLES / LAYOUT CONFIG
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "page_content_select_public"
  ON sarayamenu.page_content FOR SELECT USING (true);
CREATE POLICY "page_content_upsert_manager"
  ON sarayamenu.page_content FOR INSERT
  WITH CHECK (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));
CREATE POLICY "page_content_update_manager"
  ON sarayamenu.page_content FOR UPDATE
  USING (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

CREATE POLICY "component_styles_select_public"
  ON sarayamenu.component_styles FOR SELECT USING (true);
CREATE POLICY "component_styles_upsert_manager"
  ON sarayamenu.component_styles FOR INSERT
  WITH CHECK (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));
CREATE POLICY "component_styles_update_manager"
  ON sarayamenu.component_styles FOR UPDATE
  USING (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

CREATE POLICY "layout_config_select_public"
  ON sarayamenu.layout_config FOR SELECT USING (true);
CREATE POLICY "layout_config_upsert_manager"
  ON sarayamenu.layout_config FOR INSERT
  WITH CHECK (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));
CREATE POLICY "layout_config_update_manager"
  ON sarayamenu.layout_config FOR UPDATE
  USING (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

-- ═══════════════════════════════════════════════════════════
-- THEME CUSTOMIZATIONS
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "theme_customizations_select_public"
  ON sarayamenu.theme_customizations FOR SELECT USING (true);
CREATE POLICY "theme_customizations_insert_manager"
  ON sarayamenu.theme_customizations FOR INSERT
  WITH CHECK (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));
CREATE POLICY "theme_customizations_update_manager"
  ON sarayamenu.theme_customizations FOR UPDATE
  USING (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));
CREATE POLICY "theme_customizations_delete_manager"
  ON sarayamenu.theme_customizations FOR DELETE
  USING (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

-- ═══════════════════════════════════════════════════════════
-- ORDERS
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "orders_select_staff"
  ON sarayamenu.orders FOR SELECT
  USING (sarayamenu.has_restaurant_role(restaurant_id));

CREATE POLICY "orders_insert_public"
  ON sarayamenu.orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "orders_update_staff"
  ON sarayamenu.orders FOR UPDATE
  USING (sarayamenu.has_restaurant_role(restaurant_id));

CREATE POLICY "orders_delete_manager"
  ON sarayamenu.orders FOR DELETE
  USING (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

-- ═══════════════════════════════════════════════════════════
-- USERS & RESTAURANT_ACCESS
-- ═══════════════════════════════════════════════════════════
CREATE POLICY "users_select"
  ON sarayamenu.users FOR SELECT
  USING (
    id = sarayamenu.current_app_user_id()
    OR sarayamenu.is_platform_admin()
  );

CREATE POLICY "users_insert_admin"
  ON sarayamenu.users FOR INSERT
  WITH CHECK (sarayamenu.is_platform_admin());

CREATE POLICY "users_update"
  ON sarayamenu.users FOR UPDATE
  USING (
    id = sarayamenu.current_app_user_id()
    OR sarayamenu.is_platform_admin()
  );

CREATE POLICY "users_delete_admin"
  ON sarayamenu.users FOR DELETE
  USING (sarayamenu.is_platform_admin());

CREATE POLICY "restaurant_access_select"
  ON sarayamenu.restaurant_access FOR SELECT
  USING (
    user_id = sarayamenu.current_app_user_id()
    OR sarayamenu.has_restaurant_role(restaurant_id, 'manager')
  );

CREATE POLICY "restaurant_access_insert_admin"
  ON sarayamenu.restaurant_access FOR INSERT
  WITH CHECK (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

CREATE POLICY "restaurant_access_update_admin"
  ON sarayamenu.restaurant_access FOR UPDATE
  USING (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

CREATE POLICY "restaurant_access_delete_admin"
  ON sarayamenu.restaurant_access FOR DELETE
  USING (sarayamenu.has_restaurant_role(restaurant_id, 'manager'));

-- ─────────────────────────────────────────────────────────────
-- Grants for PostgREST (anon / authenticated / service_role)
-- ─────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA sarayamenu TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA sarayamenu TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA sarayamenu TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA sarayamenu TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA sarayamenu
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sarayamenu
  GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sarayamenu
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
