BEGIN;

-- Stato degli ordini: DA_INVIARE finché non viene inviato al fornitore.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stato text NOT NULL DEFAULT 'DA_INVIARE';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS inviato_at timestamptz NULL;

-- I solleciti inseriti manualmente dalla Home non devono creare un cliente CRM.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS nome_cliente text NULL;

ALTER TABLE public.payments
  ALTER COLUMN client_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS orders_stato_inviato_at_idx
  ON public.orders(stato, inviato_at);

COMMIT;
