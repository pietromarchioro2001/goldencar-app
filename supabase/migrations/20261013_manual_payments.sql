ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS nome_cliente text;
ALTER TABLE public.payments ALTER COLUMN client_id DROP NOT NULL;
