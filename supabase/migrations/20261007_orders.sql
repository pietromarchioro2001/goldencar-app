BEGIN;

CREATE TABLE IF NOT EXISTS public.suppliers (
    id text PRIMARY KEY,
    nome text NOT NULL,
    whatsapp text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
    id text PRIMARY KEY,
    numero text UNIQUE,
    job_id text NULL,
    vehicle_id text NULL,
    supplier_id text NULL,
    cliente text,
    telefono text,
    targa text,
    veicolo text,
    prodotti jsonb NOT NULL DEFAULT '[]'::jsonb,
    stato text NOT NULL DEFAULT 'APERTO',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT orders_job_id_fkey
        FOREIGN KEY (job_id)
        REFERENCES public.jobs(id)
        ON DELETE SET NULL,

    CONSTRAINT orders_vehicle_id_fkey
        FOREIGN KEY (vehicle_id)
        REFERENCES public.vehicles(id)
        ON DELETE SET NULL,

    CONSTRAINT orders_supplier_id_fkey
        FOREIGN KEY (supplier_id)
        REFERENCES public.suppliers(id)
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.order_counter (
    id integer PRIMARY KEY,
    ultimo_numero integer NOT NULL DEFAULT 0
);

INSERT INTO public.order_counter (id, ultimo_numero)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    next_number integer;
BEGIN
    IF NEW.numero IS NULL OR btrim(NEW.numero) = '' THEN
        UPDATE public.order_counter
        SET ultimo_numero = ultimo_numero + 1
        WHERE id = 1
        RETURNING ultimo_numero INTO next_number;

        NEW.numero = lpad(next_number::text, 3, '0');
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_orders_number
ON public.orders;

CREATE TRIGGER trg_orders_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_order_number();

CREATE OR REPLACE FUNCTION public.set_orders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_suppliers_updated_at
ON public.suppliers;

CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.set_orders_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at
ON public.orders;

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_orders_updated_at();

CREATE INDEX IF NOT EXISTS orders_job_id_idx
ON public.orders(job_id);

CREATE INDEX IF NOT EXISTS orders_vehicle_id_idx
ON public.orders(vehicle_id);

CREATE INDEX IF NOT EXISTS orders_supplier_id_idx
ON public.orders(supplier_id);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goldencar_suppliers_all ON public.suppliers;
CREATE POLICY goldencar_suppliers_all
ON public.suppliers
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS goldencar_orders_all ON public.orders;
CREATE POLICY goldencar_orders_all
ON public.orders
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;

COMMIT;
