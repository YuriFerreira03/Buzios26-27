-- =====================================================================
--  ALUGUEL FLEXIVEL — substitui a divisao automatica por um plano
--  configuravel. Rode INTEIRO no SQL Editor.
--
--  O que muda:
--   - o aluguel passa a ter NOME e um DESTINATARIO (quem recebe)
--   - cada participante tem o SEU valor (nao e mais total / n de aprovados)
--   - entra e sai gente sem destruir o que ja foi pago
--   - pagamento PARCIAL: da para pagar 200 de uma parcela de 375
--   - "paid" vira coluna derivada: quem manda sao os pagamentos
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PLANO DE ALUGUEL
-- ---------------------------------------------------------------------
create table if not exists public.rent_plans (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(btrim(title)) > 0),
  payee_id   uuid not null references public.users(id),   -- quem recebe o dinheiro
  due_day    smallint not null default 10 check (due_day between 1 and 28),
  pix_key    text,
  notes      text,
  active     boolean not null default true,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.rent_plans;
create trigger set_updated_at before update on public.rent_plans
  for each row execute procedure extensions.moddatetime (updated_at);

-- ---------------------------------------------------------------------
-- 2. PARCELAS: vinculo com o plano
-- ---------------------------------------------------------------------
alter table public.rent_installments
  add column if not exists plan_id uuid references public.rent_plans(id) on delete cascade;

-- Uma pessoa pode ter parcelas de mais de um plano no mesmo mes.
alter table public.rent_installments
  drop constraint if exists rent_installments_user_id_reference_month_key;

create unique index if not exists rent_installments_plano_pessoa_mes
  on public.rent_installments (plan_id, user_id, reference_month);

-- ---------------------------------------------------------------------
-- 3. PAGAMENTOS (permitem quitacao parcial)
-- ---------------------------------------------------------------------
create table if not exists public.rent_payments (
  id             uuid primary key default gen_random_uuid(),
  installment_id uuid not null references public.rent_installments(id) on delete cascade,
  amount         numeric(12,2) not null check (amount > 0),
  paid_at        timestamptz not null default now(),
  method         text,
  note           text,
  registered_by  uuid not null references public.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists rent_payments_installment_idx
  on public.rent_payments (installment_id);

-- ---------------------------------------------------------------------
-- 4. "paid" PASSA A SER DERIVADO DOS PAGAMENTOS
-- ---------------------------------------------------------------------
drop trigger if exists rent_mark_paid on public.rent_installments;

create or replace function public.tg_rent_sync_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst   uuid := coalesce(new.installment_id, old.installment_id);
  v_total  numeric(12,2);
  v_amount numeric(12,2);
  v_last   timestamptz;
  v_by     uuid;
  v_quitou boolean;
begin
  select coalesce(sum(amount), 0), max(paid_at)
    into v_total, v_last
    from public.rent_payments where installment_id = v_inst;

  select amount into v_amount
    from public.rent_installments where id = v_inst;

  if v_amount is null then
    return null;   -- parcela ja foi apagada
  end if;

  select registered_by into v_by
    from public.rent_payments
   where installment_id = v_inst
   order by paid_at desc
   limit 1;

  v_quitou := (v_amount > 0 and v_total >= v_amount);

  update public.rent_installments set
    paid         = v_quitou,
    paid_at      = case when v_quitou then v_last else null end,
    confirmed_by = case when v_quitou then v_by   else null end
  where id = v_inst;

  return null;
end;
$$;

drop trigger if exists rent_payment_sync on public.rent_payments;
create trigger rent_payment_sync
  after insert or update or delete on public.rent_payments
  for each row execute function public.tg_rent_sync_paid();

-- Se o valor da parcela muda, o status de quitada precisa ser reavaliado.
create or replace function public.tg_rent_amount_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(12,2);
begin
  if new.amount is distinct from old.amount then
    select coalesce(sum(amount), 0) into v_total
      from public.rent_payments where installment_id = new.id;

    new.paid := (new.amount > 0 and v_total >= new.amount);

    if new.paid then
      select max(paid_at) into new.paid_at
        from public.rent_payments where installment_id = new.id;
      select registered_by into new.confirmed_by
        from public.rent_payments where installment_id = new.id
        order by paid_at desc limit 1;
    else
      new.paid_at      := null;
      new.confirmed_by := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists rent_amount_sync on public.rent_installments;
create trigger rent_amount_sync before update on public.rent_installments
  for each row execute function public.tg_rent_amount_sync();

-- Ninguem marca "pago" na mao: so pagamento registrado quita parcela.
revoke update on public.rent_installments from authenticated;
grant update (notes, receipt_path) on public.rent_installments to authenticated;

-- ---------------------------------------------------------------------
-- 5. VIEW DE SITUACAO
-- ---------------------------------------------------------------------
create or replace view public.v_rent_status with (security_invoker = on) as
select
  r.id,
  r.plan_id,
  r.user_id,
  r.reference_month,
  r.due_date,
  r.amount,
  coalesce(p.total, 0)              as pago,
  r.amount - coalesce(p.total, 0)   as restante,
  r.paid,
  r.paid_at
from public.rent_installments r
left join lateral (
  select sum(amount) total from public.rent_payments where installment_id = r.id
) p on true;

-- ---------------------------------------------------------------------
-- 6. CONFIGURAR PARTICIPANTES E VALORES
--    p_shares: [{"user_id":"...","total":1500.00}, ...]
--    Cada pessoa pode ter um total diferente. O total de cada uma e
--    dividido pelos meses do periodo (resto dos centavos na 1a parcela).
--    Quem sai da lista tem as parcelas removidas, EXCETO as que ja
--    receberam algum pagamento.
-- ---------------------------------------------------------------------
create or replace function public.rent_set_participants(
  p_plan_id     uuid,
  p_first_month date,
  p_last_month  date,
  p_shares      jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meses   int;
  v_due_day smallint;
  v_share   jsonb;
  v_user    uuid;
  v_total_c int;
  v_base    int;
  v_resto   int;
  v_valor   numeric(12,2);
  v_mes     date;
  v_pago    numeric(12,2);
  k         int;
  v_count   int := 0;
  v_ids     uuid[];
begin
  if not public.is_member() then
    raise exception 'Apenas membros aprovados podem configurar o aluguel.' using errcode = '42501';
  end if;

  select due_day into v_due_day from public.rent_plans where id = p_plan_id;
  if v_due_day is null then
    raise exception 'Plano de aluguel nao encontrado.';
  end if;

  p_first_month := date_trunc('month', p_first_month)::date;
  p_last_month  := date_trunc('month', p_last_month)::date;

  v_meses := (extract(year from p_last_month) - extract(year from p_first_month)) * 12
           + (extract(month from p_last_month) - extract(month from p_first_month)) + 1;

  if v_meses < 1 then
    raise exception 'Periodo invalido: o ultimo mes vem antes do primeiro.';
  end if;

  select array_agg((x ->> 'user_id')::uuid) into v_ids
    from jsonb_array_elements(p_shares) x;

  -- Tira quem saiu da lista, preservando parcelas que ja receberam dinheiro.
  delete from public.rent_installments r
   where r.plan_id = p_plan_id
     and not (r.user_id = any(coalesce(v_ids, array[]::uuid[])))
     and not exists (select 1 from public.rent_payments p where p.installment_id = r.id);

  -- Tira meses que sairam do periodo, mesma protecao.
  delete from public.rent_installments r
   where r.plan_id = p_plan_id
     and (r.reference_month < p_first_month or r.reference_month > p_last_month)
     and not exists (select 1 from public.rent_payments p where p.installment_id = r.id);

  for v_share in select * from jsonb_array_elements(p_shares) loop
    v_user    := (v_share ->> 'user_id')::uuid;
    v_total_c := round((v_share ->> 'total')::numeric * 100)::int;

    v_base  := v_total_c / v_meses;
    v_resto := v_total_c - v_base * v_meses;

    for k in 0 .. v_meses - 1 loop
      v_mes   := (p_first_month + (k || ' month')::interval)::date;
      v_valor := ((v_base + case when k < v_resto then 1 else 0 end)::numeric / 100);

      -- Nunca deixa o valor da parcela ficar abaixo do que ja foi pago.
      select coalesce(sum(pay.amount), 0) into v_pago
        from public.rent_payments pay
        join public.rent_installments r on r.id = pay.installment_id
       where r.plan_id = p_plan_id and r.user_id = v_user and r.reference_month = v_mes;

      if v_pago > v_valor then
        v_valor := v_pago;
      end if;

      insert into public.rent_installments (plan_id, user_id, reference_month, due_date, amount)
      values (p_plan_id, v_user, v_mes, v_mes + (v_due_day - 1), v_valor)
      on conflict (plan_id, user_id, reference_month)
      do update set amount = excluded.amount, due_date = excluded.due_date;

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.rent_set_participants(uuid, date, date, jsonb) to authenticated;

-- A funcao antiga nao serve mais: dividia por todos os aprovados.
drop function if exists public.generate_rent_installments(numeric, date, date, smallint);

-- ---------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------
alter table public.rent_plans    enable row level security;
alter table public.rent_payments enable row level security;

drop policy if exists rent_plans_select on public.rent_plans;
create policy rent_plans_select on public.rent_plans
  for select to authenticated using (public.is_member());

drop policy if exists rent_plans_insert on public.rent_plans;
create policy rent_plans_insert on public.rent_plans
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());

drop policy if exists rent_plans_update on public.rent_plans;
create policy rent_plans_update on public.rent_plans
  for update to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists rent_plans_delete on public.rent_plans;
create policy rent_plans_delete on public.rent_plans
  for delete to authenticated using (created_by = auth.uid() or payee_id = auth.uid());

drop policy if exists rent_payments_select on public.rent_payments;
create policy rent_payments_select on public.rent_payments
  for select to authenticated using (public.is_member());

-- Voce registra o SEU pagamento; quem recebe pode registrar o de qualquer um.
drop policy if exists rent_payments_insert on public.rent_payments;
create policy rent_payments_insert on public.rent_payments
  for insert to authenticated
  with check (
    public.is_member()
    and registered_by = auth.uid()
    and exists (
      select 1
        from public.rent_installments r
        left join public.rent_plans pl on pl.id = r.plan_id
       where r.id = installment_id
         and (r.user_id = auth.uid() or pl.payee_id = auth.uid())
    )
  );

drop policy if exists rent_payments_delete on public.rent_payments;
create policy rent_payments_delete on public.rent_payments
  for delete to authenticated
  using (
    registered_by = auth.uid()
    or exists (
      select 1
        from public.rent_installments r
        left join public.rent_plans pl on pl.id = r.plan_id
       where r.id = installment_id
         and (r.user_id = auth.uid() or pl.payee_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- 8. REALTIME
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.rent_plans;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.rent_payments; exception when duplicate_object then null; end;
end $$;

alter table public.rent_plans    replica identity full;
alter table public.rent_payments replica identity full;

-- ---------------------------------------------------------------------
-- 9. MIGRACAO DAS PARCELAS QUE JA EXISTEM
--    Cria um plano padrao e adota as parcelas orfas.
--    O que ja estava marcado como pago vira um pagamento registrado,
--    para nao perder historico agora que "paid" e derivado.
-- ---------------------------------------------------------------------
do $$
declare
  v_plan uuid;
  v_dono uuid;
begin
  if not exists (select 1 from public.rent_installments where plan_id is null) then
    return;
  end if;

  select id into v_dono from public.users where approved order by created_at limit 1;
  if v_dono is null then
    return;
  end if;

  insert into public.rent_plans (title, payee_id, due_day, created_by)
  values ('Casa em Búzios', v_dono, 5, v_dono)
  returning id into v_plan;

  update public.rent_installments set plan_id = v_plan where plan_id is null;

  insert into public.rent_payments (installment_id, amount, paid_at, note, registered_by)
  select r.id, r.amount, coalesce(r.paid_at, now()), 'Migrado do modelo antigo',
         coalesce(r.confirmed_by, r.user_id)
  from public.rent_installments r
  where r.paid
    and not exists (select 1 from public.rent_payments p where p.installment_id = r.id);
end $$;
