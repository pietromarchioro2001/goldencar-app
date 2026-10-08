BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS payment_paid_amount numeric(12,2) NOT NULL DEFAULT 0
  CHECK (payment_paid_amount >= 0);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) NOT NULL DEFAULT 0
  CHECK (paid_amount >= 0);

UPDATE public.jobs
SET payment_paid_amount = CASE
  WHEN payment_status = 'PAGATO' THEN COALESCE(payment_amount, 0)
  ELSE COALESCE(payment_paid_amount, 0)
END
WHERE payment_status = 'PAGATO';

UPDATE public.payments
SET paid_amount = CASE
  WHEN status = 'PAGATO' THEN COALESCE(amount, 0)
  ELSE COALESCE(paid_amount, 0)
END
WHERE status = 'PAGATO';

COMMIT;