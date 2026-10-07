BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id text PRIMARY KEY,
  nome text NOT NULL,
  whatsapp text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id text PRIMARY KEY,
  numero text NOT NULL UNIQUE DEFAULT lpad(nextval('public.order_number_seq')::text, 3, '0'),
  job_id text NULL REFERENCES public.jobs(id) ON DELETE SET NULL,
  vehicle_id text NULL REFERENCES public.vehicles(id) ON DELETE SET NULL,
  supplier_id text NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  cliente text,
  telefono text,
  targa text,
  veicolo text,
  prodotti jsonb NOT NULL DEFAULT '[]'::jsonb,
  stato text NOT NULL DEFAULT 'APERTO',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_job_id_idx ON public.orders(job_id);
CREATE INDEX IF NOT EXISTS orders_vehicle_id_idx ON public.orders(vehicle_id);
CREATE INDEX IF NOT EXISTS orders_supplier_id_idx ON public.orders(supplier_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders(created_at DESC);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goldencar_read_suppliers ON public.suppliers;
CREATE POLICY goldencar_read_suppliers
ON public.suppliers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS goldencar_write_suppliers ON public.suppliers;
CREATE POLICY goldencar_write_suppliers
ON public.suppliers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS goldencar_read_orders ON public.orders;
CREATE POLICY goldencar_read_orders
ON public.orders FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS goldencar_write_orders ON public.orders;
CREATE POLICY goldencar_write_orders
ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
