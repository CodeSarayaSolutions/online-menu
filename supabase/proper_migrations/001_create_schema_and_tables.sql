-- ============================================================
-- Saraya CMS — schema `sarayamenu`: core tables
-- ============================================================
-- Run in SQL editor (postgres) before 002 and 003.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS sarayamenu;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 1. USERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sarayamenu.users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar        TEXT,
  platform_role TEXT NOT NULL DEFAULT 'user'
                CHECK (platform_role IN ('admin', 'user')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sarayamenu.users IS 'App-owned accounts (bcrypt password). NOT linked to auth.users / Supabase Auth.';

CREATE TABLE sarayamenu.sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES sarayamenu.users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sarayamenu.sessions(user_id);
CREATE INDEX idx_sessions_expires ON sarayamenu.sessions(expires_at);

COMMENT ON TABLE sarayamenu.sessions IS 'Login sessions; validated via x-sarayamenu-session header for RLS.';

-- ─────────────────────────────────────────────────────────────
-- 2. RESTAURANTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sarayamenu.restaurants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name_bs       TEXT,
  tagline       TEXT NOT NULL DEFAULT '',
  tagline_bs    TEXT,
  image         TEXT NOT NULL DEFAULT '',
  logo          TEXT NOT NULL DEFAULT '',
  address       TEXT NOT NULL DEFAULT '',
  address_bs    TEXT,
  open_hours    TEXT NOT NULL DEFAULT '',
  open_hours_bs TEXT,
  wifi          TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  venue_type    TEXT NOT NULL DEFAULT 'restaurant'
                CHECK (venue_type IN (
                  'restaurant','cafe','bar','bakery',
                  'food-truck','pizzeria','pub','lounge'
                )),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sarayamenu.restaurants IS 'Each row is one venue/restaurant with basic info. The PK (id) is the URL slug.';

-- ─────────────────────────────────────────────────────────────
-- 3. RESTAURANT ACCESS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sarayamenu.restaurant_access (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES sarayamenu.users(id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL REFERENCES sarayamenu.restaurants(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'employee'
                CHECK (role IN ('manager', 'employee')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, restaurant_id)
);

COMMENT ON TABLE sarayamenu.restaurant_access IS 'Per-restaurant role assignments. One user can have one role per restaurant.';

-- ─────────────────────────────────────────────────────────────
-- 4. CATEGORIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sarayamenu.categories (
  id            TEXT NOT NULL,
  restaurant_id TEXT NOT NULL REFERENCES sarayamenu.restaurants(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  label_bs      TEXT,
  icon          TEXT NOT NULL DEFAULT '🍽️',
  color         TEXT NOT NULL DEFAULT 'from-amber-400 to-orange-500',
  sort_order    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (restaurant_id, id)
);

COMMENT ON TABLE sarayamenu.categories IS 'Menu categories per restaurant. Composite PK (restaurant_id, id).';

-- ─────────────────────────────────────────────────────────────
-- 5. PRODUCTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sarayamenu.products (
  id             TEXT PRIMARY KEY,
  restaurant_id  TEXT NOT NULL REFERENCES sarayamenu.restaurants(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  name           TEXT NOT NULL,
  name_bs        TEXT,
  description    TEXT NOT NULL DEFAULT '',
  description_bs TEXT,
  price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  image          TEXT NOT NULL DEFAULT '',
  popular        BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order     INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_products_restaurant ON sarayamenu.products(restaurant_id);

COMMENT ON TABLE sarayamenu.products IS 'Individual menu items. Each belongs to one restaurant and one category.';

-- ─────────────────────────────────────────────────────────────
-- 6. ADDONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sarayamenu.addons (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES sarayamenu.products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  name_bs    TEXT,
  price      NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_addons_product ON sarayamenu.addons(product_id);

COMMENT ON TABLE sarayamenu.addons IS 'Extra items that can be added to a product (e.g., extra cheese).';

-- ─────────────────────────────────────────────────────────────
-- 7. VARIATIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sarayamenu.variations (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES sarayamenu.products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  name_bs    TEXT,
  required   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_variations_product ON sarayamenu.variations(product_id);

COMMENT ON TABLE sarayamenu.variations IS 'Product variation groups (e.g., Size, Crust Type).';

-- ─────────────────────────────────────────────────────────────
-- 8. VARIATION OPTIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sarayamenu.variation_options (
  id               TEXT PRIMARY KEY,
  variation_id     TEXT NOT NULL REFERENCES sarayamenu.variations(id) ON DELETE CASCADE,
  label            TEXT NOT NULL,
  label_bs         TEXT,
  price_adjustment NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_variation_options_variation ON sarayamenu.variation_options(variation_id);

COMMENT ON TABLE sarayamenu.variation_options IS 'Individual options within a variation group (e.g., Small/Medium/Large).';

-- ─────────────────────────────────────────────────────────────
-- 9. PAGE CONTENT
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sarayamenu.page_content (
  restaurant_id TEXT PRIMARY KEY REFERENCES sarayamenu.restaurants(id) ON DELETE CASCADE,
  content       JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE sarayamenu.page_content IS 'All editable frontend text for a venue. Stored as JSONB for flexibility.';

-- ─────────────────────────────────────────────────────────────
-- 10. COMPONENT STYLES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sarayamenu.component_styles (
  restaurant_id TEXT PRIMARY KEY REFERENCES sarayamenu.restaurants(id) ON DELETE CASCADE,
  styles        JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE sarayamenu.component_styles IS 'Visual styling for all components. Stored as JSONB.';

-- ─────────────────────────────────────────────────────────────
-- 11. LAYOUT CONFIG
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sarayamenu.layout_config (
  restaurant_id TEXT PRIMARY KEY REFERENCES sarayamenu.restaurants(id) ON DELETE CASCADE,
  config        JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE sarayamenu.layout_config IS 'Page structure config. Stored as JSONB.';

-- ─────────────────────────────────────────────────────────────
-- 12. THEME CUSTOMIZATIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sarayamenu.theme_customizations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id    TEXT NOT NULL REFERENCES sarayamenu.restaurants(id) ON DELETE CASCADE,
  theme_id         TEXT NOT NULL,
  component_styles JSONB NOT NULL DEFAULT '{}'::jsonb,
  layout_config    JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_content     JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (restaurant_id, theme_id)
);

COMMENT ON TABLE sarayamenu.theme_customizations IS 'Per-theme overrides for each venue.';

-- ─────────────────────────────────────────────────────────────
-- 13. ORDERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sarayamenu.orders (
  id            TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES sarayamenu.restaurants(id) ON DELETE CASCADE,
  items         JSONB NOT NULL DEFAULT '[]'::jsonb,
  table_number  TEXT NOT NULL DEFAULT '',
  kitchen_note  TEXT NOT NULL DEFAULT '',
  total         NUMERIC(10,2) NOT NULL DEFAULT 0,
  item_count    INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','preparing','ready','served','cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_restaurant ON sarayamenu.orders(restaurant_id);
CREATE INDEX idx_orders_status ON sarayamenu.orders(status);
CREATE INDEX idx_orders_created ON sarayamenu.orders(created_at DESC);

COMMENT ON TABLE sarayamenu.orders IS 'Customer orders. Items stored as JSONB snapshot at order time.';
