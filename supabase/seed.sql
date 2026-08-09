-- =====================================================================
--  SEED — rode DEPOIS do schema.sql
--  Troque os 8 e-mails/nomes pelos reais. E-mails sempre em minúsculo.
-- =====================================================================

insert into public.allowlist (email, full_name) values
  ('yuri@exemplo.com',     'Yuri Ferreira'),
  ('amigo2@exemplo.com',   'Amigo 2'),
  ('amigo3@exemplo.com',   'Amigo 3'),
  ('amigo4@exemplo.com',   'Amigo 4'),
  ('amigo5@exemplo.com',   'Amigo 5'),
  ('amigo6@exemplo.com',   'Amigo 6'),
  ('amigo7@exemplo.com',   'Amigo 7'),
  ('amigo8@exemplo.com',   'Amigo 8')
on conflict (email) do update set full_name = excluded.full_name;

insert into public.trip_settings (id, house_name, house_total, members_count, check_in, check_out, countdown_target)
values (true, 'Casa em Búzios', 24000.00, 8, '2026-12-29', '2027-01-02', '2026-12-31 20:00:00-03')
on conflict (id) do update set
  house_name       = excluded.house_name,
  house_total      = excluded.house_total,
  members_count    = excluded.members_count,
  check_in         = excluded.check_in,
  check_out        = excluded.check_out,
  countdown_target = excluded.countdown_target;

-- Álbuns iniciais do feed.
insert into public.albums (name, created_by)
select v.name, u.id
from (values ('Chegada'), ('Praia'), ('Réveillon'), ('Ressaca')) as v(name)
cross join lateral (select id from public.users order by created_at limit 1) u
on conflict (name) do nothing;

-- =====================================================================
--  PARCELAS DO ALUGUEL
--  Rode SÓ depois que os 8 tiverem feito o primeiro login
--  (as parcelas são geradas para quem já existe em public.users).
--  Exemplo: R$ 24.000 divididos entre os membros, de set/2026 a dez/2026,
--  vencendo todo dia 10.
-- =====================================================================
-- select public.generate_rent_installments(24000.00, '2026-09-01', '2026-12-01', 10);
