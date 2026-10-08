BEGIN;

CREATE TABLE IF NOT EXISTS public.vehicle_media (
  id text PRIMARY KEY,
  vehicle_id text NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size bigint NOT NULL DEFAULT 0,
  r2_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_media_vehicle_id_idx
  ON public.vehicle_media(vehicle_id);

CREATE INDEX IF NOT EXISTS vehicle_media_created_at_idx
  ON public.vehicle_media(created_at DESC);

ALTER TABLE public.vehicle_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goldencar_vehicle_media_all ON public.vehicle_media;
CREATE POLICY goldencar_vehicle_media_all
ON public.vehicle_media
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.vehicle_media
TO anon, authenticated;

COMMIT;
