-- Per-date shift roster (staff assignments for specific calendar dates)
-- Run after shift-weekly-schedule.sql

CREATE TABLE IF NOT EXISTS sarayamenu.shift_daily_roster (
  restaurant_id text NOT NULL,
  roster_date date NOT NULL,
  saved_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shift_daily_roster_pkey PRIMARY KEY (restaurant_id, roster_date),
  CONSTRAINT shift_daily_roster_restaurant_id_fkey FOREIGN KEY (restaurant_id)
    REFERENCES sarayamenu.restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sarayamenu.shift_date_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id text NOT NULL,
  roster_date date NOT NULL,
  segment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  restaurant_role text NOT NULL
    CHECK (restaurant_role = ANY (ARRAY['manager'::text, 'kitchen'::text, 'bar'::text, 'employee'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shift_date_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT shift_date_assignments_restaurant_id_fkey FOREIGN KEY (restaurant_id)
    REFERENCES sarayamenu.restaurants(id) ON DELETE CASCADE,
  CONSTRAINT shift_date_assignments_segment_id_fkey FOREIGN KEY (segment_id)
    REFERENCES sarayamenu.day_shift_segments(id) ON DELETE CASCADE,
  CONSTRAINT shift_date_assignments_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES sarayamenu.users(id) ON DELETE CASCADE,
  CONSTRAINT shift_date_assignments_unique UNIQUE (roster_date, segment_id, user_id)
);

CREATE INDEX IF NOT EXISTS shift_date_assignments_restaurant_date_idx
  ON sarayamenu.shift_date_assignments (restaurant_id, roster_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON sarayamenu.shift_daily_roster,
     sarayamenu.shift_date_assignments
  TO anon, authenticated;

ALTER TABLE sarayamenu.shift_daily_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.shift_date_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shift_daily_roster_all ON sarayamenu.shift_daily_roster;
CREATE POLICY shift_daily_roster_all ON sarayamenu.shift_daily_roster
  FOR ALL USING (
    sarayamenu.is_platform_admin()
    OR sarayamenu.has_restaurant_role(restaurant_id, 'owner')
    OR sarayamenu.has_restaurant_role(restaurant_id, 'manager')
  );

DROP POLICY IF EXISTS shift_date_assignments_all ON sarayamenu.shift_date_assignments;
CREATE POLICY shift_date_assignments_all ON sarayamenu.shift_date_assignments
  FOR ALL USING (
    sarayamenu.is_platform_admin()
    OR sarayamenu.has_restaurant_role(restaurant_id, 'owner')
    OR sarayamenu.has_restaurant_role(restaurant_id, 'manager')
  );
