-- ============================================================================
-- 0014_depot_assets_bucket.sql
--
-- Bug: SettingsScreen's "Upload Official Logo" calls
-- supabase.storage.from('depot_assets').upload(...) (src/services/supabase.ts
-- uploadDepotLogo), and the UI claims the logo is "Directly synced with
-- Supabase Storage bucket (depot_assets)". That bucket was never created —
-- no migration ever inserted it into storage.buckets, and storage.objects has
-- RLS enabled by default with no policy for it. Every real upload attempt
-- gets a "Bucket not found" (or, once created, an RLS-denied insert) error,
-- silently caught by uploadDepotLogo's fallback, which instead reads the file
-- as a base64 data: URI and saves THAT into app_settings.company_logo_url.
-- The logo still shows up in the nav and on receipts (the data: URI round-
-- trips through the same column fine), so this was easy to miss, but no logo
-- ever actually reaches Storage, and every settings row/read now carries a
-- multi-hundred-KB base64 blob instead of a short CDN URL.
--
-- Fix: create the depot_assets bucket (public read, so getPublicUrl() links
-- work directly in <img> tags on receipts/nav without signed URLs) and grant
-- INSERT/UPDATE to any authenticated user who can operate the Settings screen
-- (app_can_operate('settings'), added in 0011) — mirroring the app_settings
-- table's own write policy, since this bucket only ever holds the company
-- logo.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

insert into storage.buckets (id, name, public)
values ('depot_assets', 'depot_assets', true)
on conflict (id) do update set public = true;

drop policy if exists depot_assets_public_read on storage.objects;
create policy depot_assets_public_read on storage.objects
  for select
  using (bucket_id = 'depot_assets');

drop policy if exists depot_assets_settings_insert on storage.objects;
create policy depot_assets_settings_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'depot_assets' and app_can_operate('settings'));

drop policy if exists depot_assets_settings_update on storage.objects;
create policy depot_assets_settings_update on storage.objects
  for update to authenticated
  using (bucket_id = 'depot_assets' and app_can_operate('settings'))
  with check (bucket_id = 'depot_assets' and app_can_operate('settings'));

drop policy if exists depot_assets_settings_delete on storage.objects;
create policy depot_assets_settings_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'depot_assets' and app_can_operate('settings'));

RESET ROLE;
