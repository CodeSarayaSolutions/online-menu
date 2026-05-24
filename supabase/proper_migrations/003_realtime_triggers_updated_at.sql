-- ============================================================
-- Saraya CMS — schema `sarayamenu`: Realtime, triggers, updated_at
-- ============================================================
-- Run after 002_row_level_security_and_grants.sql
-- Then run 004_custom_accounts.sql (app-owned logins, NOT Supabase Auth)
-- ============================================================
-- NOTE: No triggers on auth.users — this app does not use Supabase Auth.
-- Trigger syntax uses EXECUTE PROCEDURE ...() for broad Postgres compatibility.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE sarayamenu.orders;

-- ─────────────────────────────────────────────────────────────
-- Auto-create CMS rows when a restaurant is created
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sarayamenu.handle_new_restaurant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sarayamenu, public
AS $$
BEGIN
  INSERT INTO sarayamenu.page_content (restaurant_id) VALUES (NEW.id);
  INSERT INTO sarayamenu.component_styles (restaurant_id) VALUES (NEW.id);
  INSERT INTO sarayamenu.layout_config (restaurant_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sarayamenu_on_restaurant_created ON sarayamenu.restaurants;
CREATE TRIGGER sarayamenu_on_restaurant_created
  AFTER INSERT ON sarayamenu.restaurants
  FOR EACH ROW
  EXECUTE PROCEDURE sarayamenu.handle_new_restaurant();

-- ─────────────────────────────────────────────────────────────
-- updated_at columns + triggers
-- ─────────────────────────────────────────────────────────────
ALTER TABLE sarayamenu.restaurants       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sarayamenu.products          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sarayamenu.page_content      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sarayamenu.component_styles  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sarayamenu.layout_config     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sarayamenu.orders            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION sarayamenu.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sarayamenu, public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurants_updated_at ON sarayamenu.restaurants;
CREATE TRIGGER trg_restaurants_updated_at
  BEFORE UPDATE ON sarayamenu.restaurants
  FOR EACH ROW EXECUTE PROCEDURE sarayamenu.set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON sarayamenu.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON sarayamenu.products
  FOR EACH ROW EXECUTE PROCEDURE sarayamenu.set_updated_at();

DROP TRIGGER IF EXISTS trg_page_content_updated_at ON sarayamenu.page_content;
CREATE TRIGGER trg_page_content_updated_at
  BEFORE UPDATE ON sarayamenu.page_content
  FOR EACH ROW EXECUTE PROCEDURE sarayamenu.set_updated_at();

DROP TRIGGER IF EXISTS trg_component_styles_updated_at ON sarayamenu.component_styles;
CREATE TRIGGER trg_component_styles_updated_at
  BEFORE UPDATE ON sarayamenu.component_styles
  FOR EACH ROW EXECUTE PROCEDURE sarayamenu.set_updated_at();

DROP TRIGGER IF EXISTS trg_layout_config_updated_at ON sarayamenu.layout_config;
CREATE TRIGGER trg_layout_config_updated_at
  BEFORE UPDATE ON sarayamenu.layout_config
  FOR EACH ROW EXECUTE PROCEDURE sarayamenu.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON sarayamenu.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON sarayamenu.orders
  FOR EACH ROW EXECUTE PROCEDURE sarayamenu.set_updated_at();
