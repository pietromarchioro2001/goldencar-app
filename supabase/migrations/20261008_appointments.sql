BEGIN;

CREATE TABLE IF NOT EXISTS public.appointments (
  id text PRIMARY KEY,
  vehicle_id text NULL,
  titolo text,
  descrizione text NOT NULL,
  data_ora timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointments_data_ora_idx ON public.appointments(data_ora);

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
