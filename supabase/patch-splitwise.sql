-- =====================================================================
--  MODULO GRANA — motor de despesas compartilhadas (modelo Splitwise)
--  Rode este arquivo INTEIRO no SQL Editor do Supabase.
--
--  Modelo:
--   expenses        -> uma despesa, com UM pagador e um valor total
--   expense_splits  -> quanto CADA participante deve daquela despesa
--   settlements     -> pagamento de uma pessoa para outra, quitando divida
--
--  Invariante: soma dos splits = valor da despesa.
--  Garantida pela funcao create_expense (unica porta de escrita).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENUM
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'split_method') then
    create type public.split_method as enum ('igual', 'exato', 'porcentagem', 'cotas');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. TABELAS
-- ---------------------------------------------------------------------
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  description  text not null check (length(btrim(description)) > 0),
  amount       numeric(12,2) not null check (amount > 0),
  category     public.fund_category not null default 'outros',
  paid_by      uuid not null references public.users(id),
  split_method public.split_method not null default 'igual',
  occurred_at  date not null default current_date,
  notes        text,
  receipt_path text,
  created_by   uuid not null references public.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.expense_splits (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  share      numeric(12,2) not null check (share >= 0),
  unique (expense_id, user_id)
);

create table if not exists public.settlements (
  id          uuid primary key default gen_random_uuid(),
  from_user   uuid not null references public.users(id),
  to_user     uuid not null references public.users(id),
  amount      numeric(12,2) not null check (amount > 0),
  occurred_at date not null default current_date,
  note        text,
  created_by  uuid not null references public.users(id),
  created_at  timestamptz not null default now(),
  constraint settlement_pessoas_distintas check (from_user <> to_user)
);

create index if not exists expenses_occurred_idx    on public.expenses (occurred_at desc);
create index if not exists expenses_paid_by_idx     on public.expenses (paid_by);
create index if not exists splits_expense_idx       on public.expense_splits (expense_id);
create index if not exists splits_user_idx          on public.expense_splits (user_id);
create index if not exists settlements_from_idx     on public.settlements (from_user);
create index if not exists settlements_to_idx       on public.settlements (to_user);

drop trigger if exists set_updated_at on public.expenses;
create trigger set_updated_at before update on public.expenses
  for each row execute procedure extensions.moddatetime (updated_at);

-- ---------------------------------------------------------------------
-- 3. ESCRITA ATOMICA (cria ou edita despesa + divisoes)
-- ---------------------------------------------------------------------
create or replace function public.save_expense(
  p_description  text,
  p_amount       numeric,
  p_category     text,
  p_paid_by      uuid,
  p_split_method text,
  p_occurred_at  date,
  p_splits       jsonb,               -- [{"user_id":"...","share":33.34}, ...]
  p_notes        text default null,
  p_expense_id   uuid default null    -- null = cria, preenchido = edita
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_sum numeric(12,2);
begin
  if not public.is_member() then
    raise exception 'Apenas membros aprovados podem lancar despesas.' using errcode = '42501';
  end if;

  select coalesce(sum((x ->> 'share')::numeric), 0)
    into v_sum
    from jsonb_array_elements(p_splits) x;

  if abs(v_sum - p_amount) > 0.02 then
    raise exception 'A soma das divisoes (%) nao bate com o valor da despesa (%).', v_sum, p_amount;
  end if;

  if p_expense_id is null then
    insert into public.expenses
      (description, amount, category, paid_by, split_method, occurred_at, notes, created_by)
    values
      (p_description, p_amount, p_category::public.fund_category, p_paid_by,
       p_split_method::public.split_method, p_occurred_at, p_notes, auth.uid())
    returning id into v_id;
  else
    update public.expenses set
      description  = p_description,
      amount       = p_amount,
      category     = p_category::public.fund_category,
      paid_by      = p_paid_by,
      split_method = p_split_method::public.split_method,
      occurred_at  = p_occurred_at,
      notes        = p_notes
    where id = p_expense_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Despesa nao encontrada.';
    end if;

    delete from public.expense_splits where expense_id = v_id;
  end if;

  insert into public.expense_splits (expense_id, user_id, share)
  select v_id, (x ->> 'user_id')::uuid, (x ->> 'share')::numeric
  from jsonb_array_elements(p_splits) x
  where (x ->> 'share')::numeric > 0;

  return v_id;
end;
$$;

grant execute on function public.save_expense(text, numeric, text, uuid, text, date, jsonb, text, uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- 4. VIEW DE SALDO POR PESSOA
--    saldo > 0  -> o grupo deve para ela
--    saldo < 0  -> ela deve para o grupo
-- ---------------------------------------------------------------------
create or replace view public.v_user_balances with (security_invoker = on) as
select
  u.id                                                        as user_id,
  u.full_name,
  coalesce(pg.v, 0)                                           as total_pago,
  coalesce(dv.v, 0)                                           as total_devido,
  coalesce(se.v, 0)                                           as acertos_enviados,
  coalesce(sr.v, 0)                                           as acertos_recebidos,
  coalesce(pg.v, 0) - coalesce(dv.v, 0)
    + coalesce(se.v, 0) - coalesce(sr.v, 0)                   as saldo
from public.users u
left join lateral (select sum(e.amount) v from public.expenses e       where e.paid_by  = u.id) pg on true
left join lateral (select sum(s.share)  v from public.expense_splits s where s.user_id  = u.id) dv on true
left join lateral (select sum(t.amount) v from public.settlements t    where t.from_user = u.id) se on true
left join lateral (select sum(t.amount) v from public.settlements t    where t.to_user   = u.id) sr on true
where u.approved;

-- ---------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------
alter table public.expenses       enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements    enable row level security;

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated using (public.is_member());

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses
  for delete to authenticated using (created_by = auth.uid() or paid_by = auth.uid());

-- INSERT/UPDATE só pela funcao save_expense (security definer),
-- para que a soma das divisoes nunca fique inconsistente.

drop policy if exists splits_select on public.expense_splits;
create policy splits_select on public.expense_splits
  for select to authenticated using (public.is_member());

drop policy if exists settlements_select on public.settlements;
create policy settlements_select on public.settlements
  for select to authenticated using (public.is_member());

drop policy if exists settlements_insert on public.settlements;
create policy settlements_insert on public.settlements
  for insert to authenticated
  with check (public.is_member() and created_by = auth.uid());

drop policy if exists settlements_delete on public.settlements;
create policy settlements_delete on public.settlements
  for delete to authenticated
  using (created_by = auth.uid() or from_user = auth.uid() or to_user = auth.uid());

-- ---------------------------------------------------------------------
-- 6. REALTIME
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.expenses;       exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.expense_splits; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.settlements;    exception when duplicate_object then null; end;
end $$;

alter table public.expenses       replica identity full;
alter table public.expense_splits replica identity full;
alter table public.settlements    replica identity full;
