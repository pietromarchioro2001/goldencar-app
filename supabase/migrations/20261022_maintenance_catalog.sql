-- GOLDENCAR: abilita il catalogo separato per MANUTENZIONE.
-- TAGLIANDO resta dedicato alla card TAGLIANDO; MANUTENZIONE alimenta PRODOTTI / RICAMBI.
-- Non elimina né modifica le righe già presenti nel catalogo.

alter table public.product_catalog
  drop constraint if exists product_catalog_category_check;

-- Ricolloca le categorie precedenti nella card PRODOTTI senza perdere nomi o righe.
update public.product_catalog
set category = 'MANUTENZIONE', updated_at = now()
where category in ('FRENI', 'RICAMBI');

alter table public.product_catalog
  add constraint product_catalog_category_check
  check (category in ('TAGLIANDO', 'MANUTENZIONE'));

-- I record storici appartenenti a FRENI/RICAMBI non vengono cancellati.
-- Se presenti, non saranno accettati come nuove categorie dopo questa modifica.
