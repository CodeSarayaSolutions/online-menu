-- ============================================================
-- Storage bucket `sarayamenu` — public read, authenticated upload via API
-- ============================================================
-- Create bucket in Dashboard / Coolify if it does not exist (name: sarayamenu, public).
-- Object paths: {restaurant_slug}/{placement}-{filename}
--   e.g. segafredo/hero-photo.jpg, segafredo/product-burger.png
-- ============================================================

-- Public read (menu images on guest pages)
CREATE POLICY "sarayamenu_storage_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sarayamenu');

-- Service role / server upload (Next.js /api/upload uses service_role)
-- If you upload from the client with anon + session, add INSERT policy tied to sarayamenu session helpers.
