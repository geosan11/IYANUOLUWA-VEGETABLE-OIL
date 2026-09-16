-- ============================================================================
-- 0005_custom_screen_access.sql — Per-user screen access override.
-- Depends on 0002_auth_rls.sql (profiles table).
-- ============================================================================

-- NULL (the default) = fall back to the role default (every screen except
-- the ones the client marks `adminOnly`). A non-empty array = exactly those
-- nav item ids for this user, regardless of role. Owner ignores this and
-- always sees everything (enforced client-side — see getVisibleNavItems in
-- src/constants/nav.ts).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allowed_screens TEXT[] DEFAULT NULL;

-- Owners already read/update every profile via the existing profiles_read /
-- profiles_owner_update policies from 0002_auth_rls.sql — no new policy
-- needed for this column.
