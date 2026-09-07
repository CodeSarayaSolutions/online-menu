-- Weekly shift schedule (replaces one-off datetime shifts)
-- Run in Supabase SQL editor after shifts.sql if that was already applied.

DROP TABLE IF EXISTS sarayamenu.shift_assignments CASCADE;
DROP TABLE IF EXISTS sarayamenu.shifts CASCADE;

-- day_of_week: 1 = Monday … 7 = Sunday (ISO)
CREATE TABLE IF NOT EXISTS sarayamenu.restaurant_day_hours (
  restaurant_id text NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  opens_at time NOT NULL,
  closes_at time NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_day_hours_pkey PRIMARY KEY (restaurant_id, day_of_week),
  CONSTRAINT restaurant_day_hours_restaurant_id_fkey FOREIGN KEY (restaurant_id)
    REFERENCES sarayamenu.restaurants(id) ON DELETE CASCADE,
  CONSTRAINT restaurant_day_hours_time_check CHECK (closes_at > opens_at)
);

CREATE TABLE IF NOT EXISTS sarayamenu.day_shift_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id text NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  label text NOT NULL DEFAULT ''::text,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT day_shift_segments_pkey PRIMARY KEY (id),
  CONSTRAINT day_shift_segments_restaurant_id_fkey FOREIGN KEY (restaurant_id)
    REFERENCES sarayamenu.restaurants(id) ON DELETE CASCADE,
  CONSTRAINT day_shift_segments_time_check CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS day_shift_segments_restaurant_day_idx
  ON sarayamenu.day_shift_segments (restaurant_id, day_of_week, sort_order);

CREATE TABLE IF NOT EXISTS sarayamenu.day_shift_segment_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  segment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  restaurant_role text NOT NULL
    CHECK (restaurant_role = ANY (ARRAY['manager'::text, 'kitchen'::text, 'bar'::text, 'employee'::text])),
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT day_shift_segment_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT day_shift_segment_assignments_segment_id_fkey FOREIGN KEY (segment_id)
    REFERENCES sarayamenu.day_shift_segments(id) ON DELETE CASCADE,
  CONSTRAINT day_shift_segment_assignments_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES sarayamenu.users(id) ON DELETE CASCADE,
  CONSTRAINT day_shift_segment_assignments_unique_user UNIQUE (segment_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON sarayamenu.restaurant_day_hours,
     sarayamenu.day_shift_segments,
     sarayamenu.day_shift_segment_assignments
  TO anon, authenticated;

ALTER TABLE sarayamenu.restaurant_day_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.day_shift_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sarayamenu.day_shift_segment_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS restaurant_day_hours_all ON sarayamenu.restaurant_day_hours;
CREATE POLICY restaurant_day_hours_all ON sarayamenu.restaurant_day_hours
  FOR ALL USING (
    sarayamenu.is_platform_admin()
    OR sarayamenu.has_restaurant_role(restaurant_id, 'owner')
    OR sarayamenu.has_restaurant_role(restaurant_id, 'manager')
  );

DROP POLICY IF EXISTS day_shift_segments_all ON sarayamenu.day_shift_segments;
CREATE POLICY day_shift_segments_all ON sarayamenu.day_shift_segments
  FOR ALL USING (
    sarayamenu.is_platform_admin()
    OR sarayamenu.has_restaurant_role(restaurant_id, 'owner')
    OR sarayamenu.has_restaurant_role(restaurant_id, 'manager')
  );

DROP POLICY IF EXISTS day_shift_segment_assignments_all ON sarayamenu.day_shift_segment_assignments;
CREATE POLICY day_shift_segment_assignments_all ON sarayamenu.day_shift_segment_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sarayamenu.day_shift_segments seg
      WHERE seg.id = day_shift_segment_assignments.segment_id
        AND (
          sarayamenu.is_platform_admin()
          OR sarayamenu.has_restaurant_role(seg.restaurant_id, 'owner')
          OR sarayamenu.has_restaurant_role(seg.restaurant_id, 'manager')
        )
    )
  );
