-- ============================================================================
-- 0018_public_company_branding.sql — Iyanuoluwa Vegetable & Palm Oil Depot
--
-- Bug: the login screen fetches the depot's company name + logo from
-- `app_settings` so a signed-out visitor sees real branding (and the browser
-- tab title matches). But every RLS policy in 0002_auth_rls.sql grants SELECT
-- `to authenticated` only — there is no `anon` policy on any table. Signing out
-- (or arriving fresh) therefore reads zero rows, `data` is null, and the screen
-- silently keeps its hardcoded "Iyanuoluwa Depot" fallback with no logo. The
-- feature is unreachable exactly when it is needed.
--
-- Fix: a SECURITY DEFINER function that returns ONLY the two public branding
-- fields — nothing else from app_settings (thresholds, shift hours, keg
-- prices stay private) — and is granted to `anon` as well as `authenticated`.
-- Same convention as app_current_role() / app_can_operate() from 0002/0011:
-- SECURITY DEFINER so the caller's RLS context doesn't apply, plus an explicit
-- `set search_path` so the definer's privileges can't be redirected by a
-- caller-controlled search_path.
--
-- Opens with RESET ROLE — see the note at the top of 0001_init.sql.
-- ============================================================================

RESET ROLE;

create or replace function public_company_branding()
returns table (company_name text, company_logo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select s.company_name, s.company_logo_url
  from public.app_settings s
  where s.id = 1;
$$;

comment on function public_company_branding() is
  'Public branding only (company name + logo URL) for the signed-out login screen. Deliberately narrow: exposes no other app_settings column.';

-- Reachable by anyone (that is the point) but only through this function.
revoke all on function public_company_branding() from public;
grant execute on function public_company_branding() to anon, authenticated;

RESET ROLE;
