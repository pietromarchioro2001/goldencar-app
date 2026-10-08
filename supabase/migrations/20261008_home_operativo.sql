BEGIN;

-- ORDINI:
-- lo stato esiste già nel database. Aggiungiamo solo il timestamp necessario
-- per sapere quando un ordine è stato inviato e poterlo eliminare dopo mezzanotte.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS inviato_at timestamptz NULL;

ALTER TABLE public.orders
  ALTER COLUMN stato SET DEFAULT 'DA_INVIARE';

-- Gli ordini già presenti con il vecchio stato vengono considerati ancora da inviare.
UPDATE public.orders
SET stato = 'DA_INVIARE'
WHERE stato IS NULL OR stato = 'APERTO';

-- SOLLECITI MANUALI:
-- un sollecito manuale non deve creare un cliente CRM, quindi client_id deve poter essere NULL.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS nome_cliente text NULL;

ALTER TABLE public.payments
  ALTER COLUMN client_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS orders_stato_inviato_at_idx
  ON public.orders(stato, inviato_at);

COMMIT;
