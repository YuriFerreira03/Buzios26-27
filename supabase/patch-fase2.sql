-- =====================================================================
--  FASE 2 — patch. Rode no SQL Editor do Supabase.
--  Ajusta a geracao de parcelas para:
--   - dividir apenas entre membros APROVADOS
--   - permitir refazer o calculo sem perder as parcelas ja pagas
-- =====================================================================

create or replace function public.generate_rent_installments(
  p_total       numeric,
  p_first_month date,
  p_last_month  date,
  p_due_day     smallint default 10
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    record;
  v_months  integer;
  v_per_member numeric(12,2);
  v_per_month  numeric(12,2);
  v_acc     numeric(12,2);
  v_amount  numeric(12,2);
  v_month   date;
  v_i       integer;
  v_count   integer := 0;
  v_members integer;
begin
  if not public.is_member() then
    raise exception 'Apenas membros aprovados podem gerar parcelas.' using errcode = '42501';
  end if;

  p_first_month := date_trunc('month', p_first_month)::date;
  p_last_month  := date_trunc('month', p_last_month)::date;

  v_months := (extract(year from p_last_month) - extract(year from p_first_month)) * 12
            + (extract(month from p_last_month) - extract(month from p_first_month)) + 1;

  if v_months < 1 then
    raise exception 'Periodo invalido: o ultimo mes vem antes do primeiro.';
  end if;

  select count(*) into v_members from public.users where approved;
  if v_members = 0 then
    raise exception 'Nenhum membro aprovado ainda.';
  end if;

  -- Regeneracao segura: so remove o que esta em aberto.
  delete from public.rent_installments where not paid;

  v_per_member := round(p_total / v_members, 2);
  v_per_month  := round(v_per_member / v_months, 2);

  for v_user in select id from public.users where approved loop
    v_acc := 0;
    for v_i in 0 .. v_months - 1 loop
      v_month := (p_first_month + (v_i || ' month')::interval)::date;

      if v_i = v_months - 1 then
        v_amount := v_per_member - v_acc;          -- residuo dos centavos
      else
        v_amount := v_per_month;
        v_acc := v_acc + v_per_month;
      end if;

      insert into public.rent_installments (user_id, reference_month, due_date, amount)
      values (v_user.id, v_month, v_month + (p_due_day - 1), v_amount)
      on conflict (user_id, reference_month) do nothing;

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.generate_rent_installments(numeric, date, date, smallint) to authenticated;
