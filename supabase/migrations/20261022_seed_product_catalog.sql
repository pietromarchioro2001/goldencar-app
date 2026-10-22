-- Popola il catalogo condiviso con i prodotti predefiniti di TAGLIANDO E MANUTENZIONE.
-- Sicuro da rieseguire: non crea duplicati per categoria e nome.
insert into public.product_catalog (category, name, active)
values
  ('TAGLIANDO', 'Olio motore', true),
  ('TAGLIANDO', 'Filtro olio', true),
  ('TAGLIANDO', 'Filtro aria', true),
  ('TAGLIANDO', 'Filtro abitacolo', true),
  ('TAGLIANDO', 'Filtro carburante', true),
  ('TAGLIANDO', 'Candele', true),
  ('TAGLIANDO', 'Liquido refrigerante', true),
  ('TAGLIANDO', 'Lavavetri', true)
on conflict (category, normalized_name)
do update set active = true, updated_at = now();

-- Verifica il risultato.
select category, name, active
from public.product_catalog
where category = 'TAGLIANDO'
order by name;
