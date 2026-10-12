-- Fix job creation: the jobs trigger increments job_counter.
-- Execute as the Supabase project owner (SQL Editor).
-- SECURITY DEFINER lets the trigger update its internal counter without
-- opening job_counter to direct anon/authenticated writes.
ALTER FUNCTION public.genera_numero_scheda()
  SECURITY DEFINER;

ALTER FUNCTION public.genera_numero_scheda()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.set_job_id()
  SECURITY DEFINER;

ALTER FUNCTION public.set_job_id()
  SET search_path = public, pg_temp;
