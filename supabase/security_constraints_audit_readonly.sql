-- GOLDENCAR — targeted constraints/indexes audit.
-- READ ONLY: does not modify data, schema, policies or grants.
-- Run only in Supabase PREVIEW before applying the lockdown.

WITH target AS (
  SELECT unnest(ARRAY[
    'clients','vehicles','vehicle_clients','vehicle_documents','vehicle_media',
    'jobs','job_counter','job_files','orders','order_counter','payments','payments_due',
    'appointments','suppliers'
  ]) AS table_name
),
constraints_report AS (
  SELECT
    c.relname AS table_name,
    con.conname AS constraint_name,
    CASE con.contype
      WHEN 'p' THEN 'PRIMARY KEY'
      WHEN 'u' THEN 'UNIQUE'
      WHEN 'f' THEN 'FOREIGN KEY'
      WHEN 'c' THEN 'CHECK'
      WHEN 'x' THEN 'EXCLUSION'
      ELSE con.contype::text
    END AS constraint_type,
    pg_get_constraintdef(con.oid, true) AS definition
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (SELECT table_name FROM target)
),
indexes_report AS (
  SELECT
    tablename AS table_name,
    indexname AS index_name,
    indexdef AS definition
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN (SELECT table_name FROM target)
),
function_privileges AS (
  SELECT
    p.oid::regprocedure::text AS function_signature,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
    p.prosecdef AS security_definer,
    p.prorettype::regtype::text AS return_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'genera_numero_scheda','set_job_id','set_order_number',
      'set_orders_updated_at','set_updated_at'
    )
)
SELECT jsonb_pretty(jsonb_build_object(
  'warning', 'READ ONLY: no changes made',
  'constraints', (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY table_name, constraint_name), '[]'::jsonb) FROM constraints_report c),
  'indexes', (SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY table_name, index_name), '[]'::jsonb) FROM indexes_report i),
  'function_privileges', (SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY function_signature), '[]'::jsonb) FROM function_privileges f)
)) AS goldencar_constraints_audit;
