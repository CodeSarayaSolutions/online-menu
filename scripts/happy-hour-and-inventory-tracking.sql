-- Happy hour schedules + inventory tracking flag for the sarayamenu schema.
-- Run this against the same database/schema exposed to PostgREST.
-- This script intentionally keeps RLS policy changes out of the migration body;
-- use the app-owned session header / existing service routes as before.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sarayamenu.happy_hour_schedules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references sarayamenu.restaurants(id) on delete cascade,
  label text,
  start_time time not null,
  end_time time not null,
  active boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint happy_hour_schedules_valid_time check (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS sarayamenu.happy_hour_products (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references sarayamenu.happy_hour_schedules(id) on delete cascade,
  product_id text not null references sarayamenu.products(id) on delete cascade,
  override_price numeric not null,
  constraint happy_hour_products_price_positive check (override_price > 0),
  constraint happy_hour_products_unique unique (schedule_id, product_id)
);

CREATE INDEX IF NOT EXISTS happy_hour_schedules_restaurant_active_idx
  on sarayamenu.happy_hour_schedules (restaurant_id, active, start_time, end_time);

CREATE INDEX IF NOT EXISTS happy_hour_products_schedule_idx
  on sarayamenu.happy_hour_products (schedule_id);

CREATE INDEX IF NOT EXISTS happy_hour_products_product_idx
  on sarayamenu.happy_hour_products (product_id);

ALTER TABLE sarayamenu.inventory
  add column if not exists tracked boolean not null default true;

CREATE TABLE IF NOT EXISTS sarayamenu.inventory_audit_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text,
  product_id text,
  product_name text,
  changed_by text,
  changed_by_name text,
  field_changed text,
  old_value text,
  new_value text,
  created_at timestamp with time zone not null default now()
);

CREATE INDEX IF NOT EXISTS inventory_audit_log_restaurant_created_idx
  on sarayamenu.inventory_audit_log (restaurant_id, created_at desc);

CREATE INDEX IF NOT EXISTS inventory_audit_log_product_created_idx
  on sarayamenu.inventory_audit_log (product_id, created_at desc);

NOTIFY pgrst, 'reload schema';
