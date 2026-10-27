-- GOLDENCAR — supplemental security audit (READ ONLY).
-- Run ONLY in Supabase Preview. No tables, data, grants, policies, or functions are modified.
-- Purpose: detect any additional exposed public tables/views/sequences/functions outside the first audit.

WITH relations AS (
  SELECT n.nspname AS schema_name, c.relname AS object_name,
         c.relkind,
         c.relrowsecurity AS rls_enabled,
         c.relforcerowsecurity AS rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r','p','v','m','f')
),
relation_grants AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'object', r.schema_name || '.' || r.object_name,
    'kind', CASE r.relkind
      WHEN 'r' THEN 'table'
      WHEN 'p' THEN 'partitioned_table'
      WHEN 'v' THEN 'view'
      WHEN 'm' THEN 'materialized_view'
      WHEN 'f' THEN 'foreign_table'
      ELSE r.relkind::text END,
    'rls_enabled', r.rls_enabled,
    'rls_forced', r.rls_forced,
    'anon_select', has_table_privilege('anon', format('%I.%I', r.schema_name, r.object_name), 'SELECT'),
    'anon_insert', has_table_privilege('anon', format('%I.%I', r.schema_name, r.object_name), 'INSERT'),
    'anon_update', has_table_privilege('anon', format('%I.%I', r.schema_name, r.object_name), 'UPDATE'),
    'anon_delete', has_table_privilege('anon', format('%I.%I', r.schema_name, r.object_name), 'DELETE'),
    'authenticated_select', has_table_privilege('authenticated', format('%I.%I', r.schema_name, r.object_name), 'SELECT'),
    'authenticated_insert', has_table_privilege('authenticated', format('%I.%I', r.schema_name, r.object_name), 'INSERT'),
    'authenticated_update', has_table_privilege('authenticated', format('%I.%I', r.schema_name, r.object_name), 'UPDATE'),
    'authenticated_delete', has_table_privilege('authenticated', format('%I.%I', r.schema_name, r.object_name), 'DELETE')
  ) ORDER BY r.object_name), '[]'::jsonb) AS items
  FROM relations r
),
sequence_info AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'sequence', n.nspname || '.' || c.relname,
    'anon_usage', has_sequence_privilege('anon', c.oid, 'USAGE'),
    'anon_select', has_sequence_privilege('anon', c.oid, 'SELECT'),
    'authenticated_usage', has_sequence_privilege('authenticated', c.oid, 'USAGE'),
    'authenticated_select', has_sequence_privilege('authenticated', c.oid, 'SELECT')
  ) ORDER BY c.relname), '[]'::jsonb) AS items
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'S'
),
function_info AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'function', n.nspname || '.' || p.proname,
    'arguments', pg_get_function_identity_arguments(p.oid),
    'security_definer', p.prosecdef,
    'search_path_config', p.proconfig,
    'anon_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
    'authenticated_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    'public_execute', has_function_privilege('public', p.oid, 'EXECUTE')
  ) ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::jsonb) AS items
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
),
policy_info AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'table', schemaname || '.' || tablename,
    'name', policyname,
    'command', cmd,
    'roles', roles,
    'using', qual,
    'with_check', with_check
  ) ORDER BY tablename, policyname), '[]'::jsonb) AS items
  FROM pg_policies WHERE schemaname = 'public'
)
SELECT jsonb_pretty(jsonb_build_object(
  'generated_at', now(),
  'warning', 'READ ONLY: no changes made',
  'public_schema_usage', jsonb_build_object(
    'anon_usage', has_schema_privilege('anon', 'public', 'USAGE'),
    'authenticated_usage', has_schema_privilege('authenticated', 'public', 'USAGE')
  ),
  'public_relations', (SELECT items FROM relation_grants),
  'public_sequences', (SELECT items FROM sequence_info),
  'public_functions', (SELECT items FROM function_info),
  'public_policies', (SELECT items FROM policy_info)
)) AS goldencar_security_audit_extended;
