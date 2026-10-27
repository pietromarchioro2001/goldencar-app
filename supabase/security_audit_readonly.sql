-- GOLDENCAR: audit SQL READ-ONLY.
-- This query does not change tables, grants, RLS, policies, or data.
-- Run it in the Supabase SQL Editor for the PREVIEW project first.
-- Copy the single JSON result back for review before generating any mutating SQL.

WITH relevant_tables AS (
  SELECT t.table_schema, t.table_name
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name IN (
      'appointments', 'clients', 'jobs', 'job_counter', 'job_files',
      'orders', 'order_counter', 'payments', 'payments_due', 'suppliers',
      'vehicle_clients', 'vehicle_documents', 'vehicle_media', 'vehicles'
    )
),
columns_info AS (
  SELECT c.table_schema, c.table_name,
         jsonb_agg(
           jsonb_build_object(
             'column', c.column_name,
             'type', c.data_type,
             'udt', c.udt_name,
             'nullable', c.is_nullable,
             'default', c.column_default
           ) ORDER BY c.ordinal_position
         ) AS columns
  FROM information_schema.columns c
  JOIN relevant_tables t USING (table_schema, table_name)
  GROUP BY c.table_schema, c.table_name
),
table_info AS (
  SELECT t.table_name,
         COALESCE(c.columns, '[]'::jsonb) AS columns,
         COALESCE(cl.relrowsecurity, false) AS rls_enabled,
         COALESCE(cl.relforcerowsecurity, false) AS rls_forced
  FROM relevant_tables t
  LEFT JOIN columns_info c USING (table_schema, table_name)
  LEFT JOIN pg_namespace n ON n.nspname = t.table_schema
  LEFT JOIN pg_class cl ON cl.relnamespace = n.oid AND cl.relname = t.table_name
),
policies_info AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'table', schemaname || '.' || tablename,
        'name', policyname,
        'command', cmd,
        'roles', roles,
        'using', qual,
        'with_check', with_check
      ) ORDER BY schemaname, tablename, policyname
    ), '[]'::jsonb
  ) AS items
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (SELECT table_name FROM relevant_tables)
),
grants_info AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'table', table_schema || '.' || table_name,
        'grantee', grantee,
        'privilege', privilege_type,
        'grantable', is_grantable
      ) ORDER BY table_name, grantee, privilege_type
    ), '[]'::jsonb
  ) AS items
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN (SELECT table_name FROM relevant_tables)
    AND grantee IN ('anon', 'authenticated', 'PUBLIC', 'service_role')
),
functions_info AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'function', n.nspname || '.' || p.proname,
        'arguments', pg_get_function_identity_arguments(p.oid),
        'security_definer', p.prosecdef,
        'search_path_config', p.proconfig,
        'owner', pg_get_userbyid(p.proowner),
        'execute_acl', COALESCE(p.proacl::text, 'default')
      ) ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
    ), '[]'::jsonb
  ) AS items
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'genera_numero_scheda',
      'set_job_id',
      'set_order_number',
      'set_orders_updated_at',
      'set_updated_at'
    )
),
sequence_info AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'sequence', n.nspname || '.' || c.relname,
        'owner', pg_get_userbyid(c.relowner),
        'acl', COALESCE(c.relacl::text, 'default')
      ) ORDER BY c.relname
    ), '[]'::jsonb
  ) AS items
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'S'
    AND c.relname IN ('order_number_seq')
)
SELECT jsonb_pretty(
  jsonb_build_object(
    'generated_at', now(),
    'warning', 'READ ONLY: no changes made',
    'tables', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.table_name), '[]'::jsonb) FROM table_info t),
    'policies', (SELECT items FROM policies_info),
    'table_grants', (SELECT items FROM grants_info),
    'security_sensitive_functions', (SELECT items FROM functions_info),
    'sequences', (SELECT items FROM sequence_info)
  )
) AS goldencar_security_audit;
