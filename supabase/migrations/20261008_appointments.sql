BEGIN;

CREATE TABLE IF NOT EXISTS public.appointments (
  id text PRIMARY KEY,
  date date NOT NULL,
  time time NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointments_date_idx ON public.appointments(date);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goldencar_appointments_all ON public.appointments;
CREATE POLICY goldencar_appointments_all
ON public.appointments
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO anon, authenticated;

COMMIT;
