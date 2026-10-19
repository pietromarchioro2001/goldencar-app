-- GOLDENCAR — targeted schema/function compatibility audit.
-- READ ONLY: this script does not alter tables, data, grants, policies, or functions.
-- Run in the Supabase PREVIEW SQL Editor and share the complete result before any lockdown.

WITH target_tables(table_name) AS (
  VALUES
    ('appointments'), ('clients'), ('job_counter'), ('job_files'), ('jobs'),
    ('order_counter'), ('orders'), ('payments'), ('payments_due'), ('suppliers'),
    ('vehicle_clients'), ('vehicle_documents'), ('vehicle_media'), ('vehicles')
),
columns_report AS (
  SELECT
    t.table_name,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'column', c.column_name,
          'type', c.data_type,
          'udt', c.udt_name,
          'nullable', c.is_nullable,
          'default', c.column_default
        ) ORDER BY c.ordinal_position
      ) FILTER (WHERE c.column_name IS NOT NULL),
      '[]'::jsonb
    ) AS columns
  FROM target_tables t
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = t.table_name
  GROUP BY t.table_name
),
functions_report AS (
  SELECT
    p.oid::regprocedure::text AS function_signature,
    p.prosecdef AS security_definer,
    pg_get_userbyid(p.proowner) AS owner,
    p.proconfig AS function_settings,
    pg_get_functiondef(p.oid) AS definition,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'trigger', tr.tgname,
          'table', format('%I.%I', ns.nspname, rel.relname),
          'enabled', tr.tgenabled
        ))
        FROM pg_trigger tr
        JOIN pg_class rel ON rel.oid = tr.tgrelid
        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        WHERE tr.tgfoid = p.oid AND NOT tr.tgisinternal
      ),
      '[]'::jsonb
    ) AS attached_triggers
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
)
SELECT jsonb_build_object(
  'warning', 'READ ONLY: no changes made',
  'tables', (SELECT jsonb_agg(jsonb_build_object(
    'table', table_name,
    'exists', columns <> '[]'::jsonb,
    'columns', columns
  ) ORDER BY table_name) FROM columns_report),
  'functions', (SELECT jsonb_agg(to_jsonb(functions_report) ORDER BY function_signature) FROM functions_report)
) AS goldencar_schema_compatibility_audit;
