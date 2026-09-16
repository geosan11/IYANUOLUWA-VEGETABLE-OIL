-- ============================================================================
-- 0003_multi_hub.sql — Extend user_role with 'hub_manager'.
-- Depends on 0001_init.sql and 0002_auth_rls.sql.
--
-- Split into its own file (rather than living inside 0004_multi_hub_hubs.sql)
-- because PostgreSQL will not let a newly-added enum value be *used* in the
-- same transaction that added it ("unsafe use of new value ... of enum type").
-- Since both the Supabase SQL Editor and `supabase db push` run each file as
-- one transaction, the ADD VALUE has to commit in its own migration before
-- 0004 (which references 'hub_manager' in a function body and RLS policy)
-- can run. Also runs as supabase_admin — see the note at the top of
-- 0001_init.sql.
-- ============================================================================

RESET ROLE;

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hub_manager';

RESET ROLE;
