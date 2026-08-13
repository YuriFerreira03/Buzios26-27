-- =====================================================================
--  ENQUETES — decisoes do grupo, com registro do que foi combinado
--  Rode INTEIRO no SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------
create table if not exists public.polls (
  id            uuid primary key default gen_random_uuid(),
  question      text not null check (length(btrim(question)) > 0),
  details       text,
  multi         boolean not null default false,   -- permite marcar mais de uma
  closes_at     timestamptz,                      -- prazo opcional
  closed_at     timestamptz,                      -- fechada manualmente
  decision_note text,                             -- o que ficou decidido
  created_by    uuid not null references public.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.poll_options (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references public.polls(id) on delete cascade,
  label    text not null check (length(btrim(label)) > 0),
  position smallint not null default 0
);

create table if not exists public.poll_votes (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls(id) on delete cascade,
  option_id  uuid not null references public.poll_options(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (option_id, user_id)          -- um voto por opcao por pessoa
);

create index if not exists poll_options_poll_idx on public.poll_options (poll_id, position);
create index if not exists poll_votes_poll_idx   on public.poll_votes (poll_id);
create index if not exists poll_votes_user_idx   on public.poll_votes (user_id);

drop trigger if exists set_updated_at on public.polls;
create trigger set_updated_at before update on public.polls
  for each row execute procedure extensions.moddatetime (updated_at);

-- ---------------------------------------------------------------------
-- 2. VOTO UNICO: garantido no banco, nao so na tela
--    Se a enquete nao e "multi", votar em outra opcao troca o voto.
-- ---------------------------------------------------------------------
create or replace function public.tg_poll_single_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_multi   boolean;
  v_fechada boolean;
begin
  select p.multi,
         (p.closed_at is not null or (p.closes_at is not null and p.closes_at < now()))
    into v_multi, v_fechada
    from public.polls p
   where p.id = new.poll_id;

  if v_fechada then
    raise exception 'Esta enquete ja esta encerrada.' using errcode = '42501';
  end if;

  if not v_multi then
    delete from public.poll_votes
     where poll_id = new.poll_id
       and user_id = new.user_id
       and option_id <> new.option_id;
  end if;

  return new;
end;
$$;

drop trigger if exists poll_single_vote on public.poll_votes;
create trigger poll_single_vote before insert on public.poll_votes
  for each row execute function public.tg_poll_single_vote();

-- ---------------------------------------------------------------------
-- 3. CRIAR ENQUETE COM AS OPCOES DE UMA VEZ
--    p_options: ["Casa da Ferradura", "Casa de Geriba", ...]
-- ---------------------------------------------------------------------
create or replace function public.create_poll(
  p_question  text,
  p_options   jsonb,
  p_details   text default null,
  p_multi     boolean default false,
  p_closes_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_member() then
    raise exception 'Apenas membros aprovados podem criar enquetes.' using errcode = '42501';
  end if;

  if jsonb_array_length(p_options) < 2 then
    raise exception 'A enquete precisa de pelo menos duas opcoes.';
  end if;

  insert into public.polls (question, details, multi, closes_at, created_by)
  values (btrim(p_question), nullif(btrim(coalesce(p_details, '')), ''), p_multi, p_closes_at, auth.uid())
  returning id into v_id;

  insert into public.poll_options (poll_id, label, position)
  select v_id, btrim(x.value #>> '{}'), (x.ordinality - 1)::smallint
  from jsonb_array_elements(p_options) with ordinality as x(value, ordinality)
  where length(btrim(x.value #>> '{}')) > 0;

  return v_id;
end;
$$;

grant execute on function public.create_poll(text, jsonb, text, boolean, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- 4. RESUMO PARA A LISTA
-- ---------------------------------------------------------------------
create or replace view public.v_poll_summary with (security_invoker = on) as
select
  p.id,
  p.question,
  p.multi,
  p.closes_at,
  p.closed_at,
  p.decision_note,
  p.created_by,
  p.created_at,
  (p.closed_at is not null or (p.closes_at is not null and p.closes_at < now())) as encerrada,
  (select count(distinct v.user_id) from public.poll_votes v where v.poll_id = p.id) as votantes,
  (select count(*) from public.users u where u.approved)                            as elegiveis
from public.polls p;

-- ---------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------
alter table public.polls        enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes   enable row level security;

drop policy if exists polls_select on public.polls;
create policy polls_select on public.polls
  for select to authenticated using (public.is_member());

drop policy if exists polls_update on public.polls;
create policy polls_update on public.polls
  for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists polls_delete on public.polls;
create policy polls_delete on public.polls
  for delete to authenticated using (created_by = auth.uid());

-- INSERT so pela funcao create_poll, para nunca existir enquete sem opcoes.

drop policy if exists poll_options_select on public.poll_options;
create policy poll_options_select on public.poll_options
  for select to authenticated using (public.is_member());

drop policy if exists poll_votes_select on public.poll_votes;
create policy poll_votes_select on public.poll_votes
  for select to authenticated using (public.is_member());

-- Voce so vota por voce mesmo.
drop policy if exists poll_votes_insert on public.poll_votes;
create policy poll_votes_insert on public.poll_votes
  for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());

drop policy if exists poll_votes_delete on public.poll_votes;
create policy poll_votes_delete on public.poll_votes
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 6. REALTIME
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.polls;        exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.poll_options; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.poll_votes;   exception when duplicate_object then null; end;
end $$;

alter table public.polls      replica identity full;
alter table public.poll_votes replica identity full;
