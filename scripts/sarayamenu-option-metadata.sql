alter table sarayamenu.addons
  add column if not exists group_id text,
  add column if not exists group_label text,
  add column if not exists min_select integer,
  add column if not exists max_select integer,
  add column if not exists depends_on_variation_id text,
  add column if not exists depends_on_option_id text;

alter table sarayamenu.variations
  add column if not exists min_select integer,
  add column if not exists max_select integer;

alter table sarayamenu.variation_options
  add column if not exists depends_on_variation_id text,
  add column if not exists depends_on_option_id text;

notify pgrst, 'reload schema';
