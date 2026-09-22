-- ============================================================================
-- 0015_depot_assets_bucket_rls.sql
--
-- Follow-up to 0014: storage.buckets has RLS enabled project-wide with no
-- policies at all (confirmed via pg_class.relrowsecurity), same as
-- storage.objects was before 0014. 0014 only added policies on
-- storage.objects; it never granted SELECT on storage.buckets itself. The
-- Storage API enforces RLS as the caller's role when resolving a bucket by
-- id/name (GET /bucket/:id, and the checks inside upload()), so every anon
-- and authenticated request for the depot_assets bucket sees zero rows and
-- gets "Bucket not found" — confirmed live: the bucket row exists
-- (public = true) but GET /storage/v1/bucket/depot_assets 404s regardless.
--
-- Fix: SELECT on storage.buckets for depot_assets is public (same audience
-- as the object read policy in 0014 — the bucket is meant to be public), and
-- kept read-only here since nothing in the app creates/renames/deletes
-- buckets client-side.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

drop policy if exists depot_assets_bucket_read on storage.buckets;
create policy depot_assets_bucket_read on storage.buckets
  for select
  using (id = 'depot_assets');

RESET ROLE;
