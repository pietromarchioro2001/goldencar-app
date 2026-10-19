-- GOLDENCAR — basic Supabase lockdown for the device-password app.
-- IMPORTANT:
-- 1) Run ONLY in the intended Supabase project after reviewing the read-only audit output.
-- 2) The Next.js API must have SUPABASE_SERVICE_ROLE_KEY set server-side in Vercel.
-- 3) The browser app must use the protected /api/* routes, not direct Supabase table access.
-- 4) This is intentionally limited to the known GOLDENCAR tables; it does not touch storage buckets.
-- 5) ROLLBACK guidance is documented below. Keep a copy of the audit output before running.
--
-- Effect: enables RLS, removes existing table policies on these tables, revokes direct
-- table access from anon/authenticated/PUBLIC, and grants table access to service_role.
-- service_role bypasses RLS and is used only by the protected server APIs.
-- No data is deleted or changed. All changes are transactional.
--
-- If a table does not exist, it is skipped (not created). In particular, verify that
-- vehicle_documents exists with the expected columns before relying on profile document saves.

BEGIN;

DO $goldencar_lockdown$
DECLARE
  table_name text;
  policy_row record;
  target_tables text[] := ARRAY[
    'appointments',
    'clients',
    'job_counter',
    'jobs',
    'order_counter',
    'orders',
    'payments',
    'suppliers',
    'vehicle_clients',
    'vehicle_documents',
    'vehicle_media',
    'vehicles'
  ];
BEGIN
  FOREACH table_name IN ARRAY target_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE NOTICE 'GOLDENCAR lockdown: public.% skipped because it does not exist', table_name;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    -- These app tables are accessed through the authenticated Next.js API using service_role.
    -- Drop any old permissive policies so an accidentally re-granted anon privilege cannot
    -- silently reopen the tables. service_role bypasses RLS and does not need these policies.
    FOR policy_row IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, table_name);
    END LOOP;

    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', table_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', table_name);

    RAISE NOTICE 'GOLDENCAR lockdown: secured public.%', table_name;
  END LOOP;

  -- The legacy order sequence is not used by the current counter trigger in all deployments,
  -- but if present it should not be directly accessible from the browser roles.
  IF to_regclass('public.order_number_seq') IS NOT NULL THEN
    REVOKE ALL PRIVILEGES ON SEQUENCE public.order_number_seq FROM PUBLIC;
    REVOKE ALL PRIVILEGES ON SEQUENCE public.order_number_seq FROM anon;
    REVOKE ALL PRIVILEGES ON SEQUENCE public.order_number_seq FROM authenticated;
    GRANT ALL PRIVILEGES ON SEQUENCE public.order_number_seq TO service_role;
  END IF;
END
$goldencar_lockdown$;

COMMIT;

-- POST-CHECK (read-only): run after the script to verify that browser roles have no table grants.
SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'appointments','clients','job_counter','jobs','order_counter','orders',
    'payments','suppliers','vehicle_clients','vehicle_documents','vehicle_media','vehicles'
  )
  AND grantee IN ('anon','authenticated','PUBLIC','service_role')
ORDER BY table_name, grantee, privilege_type;

-- ROLLBACK GUIDE (run only if a tested workflow unexpectedly fails):
-- 1) Do NOT blindly restore the old permissive policies (several allowed all anon reads/writes).
-- 2) Restore direct grants only for the specific table and operation proven necessary, after review.
-- 3) Normal app access should use the protected Next.js APIs and server-side service_role.
