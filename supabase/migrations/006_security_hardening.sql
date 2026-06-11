-- ============================================================
-- NEXOGUARD — Security hardening (resolves Supabase linter warnings)
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. FIX SEARCH_PATH MUTABLE ────────────────────────────
-- Prevents search_path injection attacks on our SECURITY DEFINER functions.
-- These 4 functions were flagged: update_updated_at, handle_new_user,
-- get_user_org_id, get_user_role.

ALTER FUNCTION public.update_updated_at()  SET search_path = '';
ALTER FUNCTION public.handle_new_user()    SET search_path = '';
ALTER FUNCTION public.get_user_org_id()    SET search_path = '';
ALTER FUNCTION public.get_user_role()      SET search_path = '';

-- ── 2. REVOKE ANON EXECUTE ON INTERNAL FUNCTIONS ──────────
-- Anonymous (unauthenticated) users should never call these directly.
-- RLS policies still work — they invoke the function through the DB
-- engine, not via the REST API role.

REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role()   FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;

-- handle_new_user is fired only by an auth trigger — no role
-- (authenticated or anon) should ever call it directly via RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- ── 3. FIX AVATARS BUCKET — RESTRICT LISTING ──────────────
-- The broad "avatars_public_read" policy let anon users list ALL files
-- in the bucket. Since the app always requires login, restrict to
-- authenticated only — objects are still publicly readable by URL.

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;

CREATE POLICY "avatars_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- ── NOTES — what was NOT fixed (and why) ──────────────────
--
-- postgis extension in public schema:
--   Installed and managed by Supabase. Moving it would require
--   re-creating all PostGIS types/functions and breaks the platform.
--   Mark as acknowledged in the Supabase linter UI.
--
-- st_estimatedextent callable by anon/authenticated:
--   Internal PostGIS C functions. Same reason — not ours to touch.
--
-- get_user_org_id / get_user_role callable by authenticated via RPC:
--   Cannot revoke EXECUTE from authenticated because every query that
--   hits an RLS policy calls these functions. Revoking would break ALL
--   row-level security checks. These warnings are false positives for
--   functions used exclusively inside RLS policies.
--
-- Leaked Password Protection:
--   Enable in Supabase Dashboard → Authentication → Providers → Email
--   → toggle "Enable Leaked Password Protection". No SQL needed.
-- ============================================================
