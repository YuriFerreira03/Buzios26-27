-- =====================================================================
--  RÉVEILLON BÚZIOS — SCHEMA COMPLETO (Postgres / Supabase)
--  Execute este arquivo INTEIRO no SQL Editor do Supabase (uma vez).
--  Ordem: extensões -> enums -> tabelas -> índices -> funções/triggers
--         -> views -> RLS -> realtime -> storage.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSÕES
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;                       -- gen_random_uuid()
create extension if not exists moddatetime schema extensions;  -- updated_at automático

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
create type public.fund_tx_type      as enum ('entrada', 'saida');
create type public.fund_category     as enum ('aluguel','mercado','bebida','transporte','passeio','utilidades','extra','outros');
create type public.shopping_category as enum ('mercado','bebida','utilidades','farmacia','outros');
create type public.roulette_type     as enum ('tarefa','quarto');
create type public.schedule_category as enum ('praia','festa','refeicao','logistica','passeio','outros');
create type public.reaction_emoji    as enum ('fogo','cerveja','caveira','risada','porDoSol');

-- ---------------------------------------------------------------------
-- 2. TABELAS
-- ---------------------------------------------------------------------

-- 2.1 ALLOWLIST -------------------------------------------------------
-- Fonte da verdade de quem pode entrar. Populada manualmente (seed.sql).
-- Nenhum e-mail fora daqui consegue criar conta (trigger em auth.users).
create table public.allowlist (
  email      text primary key check (email = lower(email)),
  full_name  text not null,
  created_at timestamptz not null default now()
);

-- 2.2 USERS (perfil) --------------------------------------------------
-- 1:1 com auth.users. Criada automaticamente no primeiro login válido.
create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  full_name  text not null,
  nickname   text,
  avatar_path text,                 -- caminho no bucket "avatars"
  phone      text,
  pix_key    text,                  -- facilita o acerto da caixinha
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.3 CONFIGURAÇÃO DA VIAGEM (registro único) -------------------------
create table public.trip_settings (
  id                boolean primary key default true,
  house_name        text,
  house_url         text,
  house_total       numeric(12,2) not null default 0,   -- valor total do aluguel
  members_count     smallint      not null default 8,
  check_in          date,
  check_out         date,
  countdown_target  timestamptz   not null default '2026-12-31 20:00:00-03',
  updated_at        timestamptz   not null default now(),
  constraint trip_settings_singleton check (id)
);

-- 2.4 ALERTAS FIXADOS (dashboard) -------------------------------------
create table public.notices (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  pinned     boolean not null default true,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.5 PARCELAS DO ALUGUEL ---------------------------------------------
create table public.rent_installments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  reference_month date not null,                          -- sempre dia 01
  due_date        date not null,
  amount          numeric(12,2) not null check (amount > 0),
  paid            boolean not null default false,
  paid_at         timestamptz,
  confirmed_by    uuid references public.users(id),       -- quem deu a baixa
  receipt_path    text,                                   -- bucket "receipts"
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, reference_month),
  constraint rent_ref_is_first_day check (extract(day from reference_month) = 1),
  constraint rent_paid_consistency  check (
    (paid is true  and paid_at is not null and confirmed_by is not null) or
    (paid is false and paid_at is null     and confirmed_by is null)
  )
);

-- 2.6 CAIXINHA (fundo comum) ------------------------------------------
create table public.common_fund_transactions (
  id           uuid primary key default gen_random_uuid(),
  type         public.fund_tx_type  not null,
  amount       numeric(12,2)        not null check (amount > 0),
  description  text                 not null,
  category     public.fund_category not null default 'outros',
  member_id    uuid not null references public.users(id),  -- quem contribuiu / quem pagou
  created_by   uuid not null references public.users(id),  -- quem registrou
  receipt_path text,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2.7 LISTA DE COMPRAS ------------------------------------------------
create table public.shopping_list (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (length(btrim(title)) > 0),
  category       public.shopping_category not null default 'mercado',
  quantity       numeric(10,2) not null default 1 check (quantity > 0),
  unit           text not null default 'un',
  estimated_cost numeric(12,2),
  checked        boolean not null default false,
  checked_by     uuid references public.users(id),
  checked_at     timestamptz,
  added_by       uuid not null references public.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint shopping_checked_consistency check (
    (checked is true  and checked_by is not null and checked_at is not null) or
    (checked is false and checked_by is null     and checked_at is null)
  )
);

-- 2.8 FEED DE FOTOS ---------------------------------------------------
create table public.albums (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  cover_path text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

-- Um post = um upload (pode conter várias fotos em feed_media).
create table public.feed_posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.users(id) on delete cascade,
  album_id   uuid references public.albums(id) on delete set null,
  caption    text,
  taken_at   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.feed_media (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.feed_posts(id) on delete cascade,
  storage_path text not null unique,      -- bucket "photos"
  width        integer,
  height       integer,
  size_bytes   integer,
  position     smallint not null default 0,
  created_at   timestamptz not null default now()
);

-- Marcação de pessoas em uma foto específica.
create table public.photo_tags (
  id         uuid primary key default gen_random_uuid(),
  media_id   uuid not null references public.feed_media(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  x          numeric(5,4),               -- 0..1 (posição relativa, opcional)
  y          numeric(5,4),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique (media_id, user_id)
);

-- 2.9 MURAL DE PÉROLAS ------------------------------------------------
create table public.quotes (
  id         uuid primary key default gen_random_uuid(),
  content    text not null check (length(btrim(content)) > 0),
  author_id  uuid not null references public.users(id) on delete cascade, -- quem falou
  context    text,                                                        -- o momento
  said_at    date,
  created_by uuid not null references public.users(id),                   -- quem registrou
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.10 COMENTÁRIOS E REAÇÕES (posts e pérolas) ------------------------
-- FK real para os dois alvos + CHECK garantindo exatamente um preenchido.
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references public.feed_posts(id) on delete cascade,
  quote_id   uuid references public.quotes(id)     on delete cascade,
  author_id  uuid not null references public.users(id) on delete cascade,
  content    text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_single_target check (num_nonnulls(post_id, quote_id) = 1)
);

create table public.reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid references public.feed_posts(id) on delete cascade,
  quote_id   uuid references public.quotes(id)     on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  emoji      public.reaction_emoji not null,
  created_at timestamptz not null default now(),
  constraint reactions_single_target check (num_nonnulls(post_id, quote_id) = 1)
);
-- Índices únicos parciais: 1 reação por emoji, por pessoa, por alvo.
create unique index reactions_post_unique  on public.reactions (post_id,  user_id, emoji) where post_id  is not null;
create unique index reactions_quote_unique on public.reactions (quote_id, user_id, emoji) where quote_id is not null;

-- 2.11 PROGRAMAÇÃO / ITINERÁRIO ---------------------------------------
create table public.schedule (
  id          uuid primary key default gen_random_uuid(),
  day         date not null,
  starts_at   time,
  ends_at     time,
  title       text not null check (length(btrim(title)) > 0),
  description text,
  location    text,
  category    public.schedule_category not null default 'outros',
  position    smallint not null default 0,       -- desempate quando não há horário
  created_by  uuid not null references public.users(id),
  updated_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint schedule_time_order check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

-- 2.12 ROLETA ---------------------------------------------------------
create table public.roulette_draws (
  id         uuid primary key default gen_random_uuid(),
  type       public.roulette_type not null,
  title      text not null,                 -- ex: "Louça do dia 30" / "Divisão de quartos"
  reference_day date,
  drawn_by   uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create table public.roulette_results (
  id       uuid primary key default gen_random_uuid(),
  draw_id  uuid not null references public.roulette_draws(id) on delete cascade,
  user_id  uuid not null references public.users(id) on delete cascade,
  result   text not null,                   -- ex: "Suíte 2 / cama de casal"
  position smallint not null default 0,
  unique (draw_id, user_id)
);

-- ---------------------------------------------------------------------
-- 3. ÍNDICES DE APOIO
-- ---------------------------------------------------------------------
create index on public.rent_installments        (user_id, reference_month);
create index on public.rent_installments        (paid, due_date);
create index on public.common_fund_transactions (occurred_at desc);
create index on public.common_fund_transactions (type, category);
create index on public.shopping_list            (checked, category);
create index on public.feed_posts               (created_at desc);
create index on public.feed_media               (post_id, position);
create index on public.photo_tags               (user_id);
create index on public.quotes                   (created_at desc);
create index on public.comments                 (post_id, created_at);
create index on public.comments                 (quote_id, created_at);
create index on public.reactions                (post_id);
create index on public.reactions                (quote_id);
create index on public.schedule                 (day, starts_at, position);
create index on public.roulette_results         (draw_id);

-- ---------------------------------------------------------------------
-- 4. FUNÇÕES E TRIGGERS
-- ---------------------------------------------------------------------

-- 4.1 Helper usado por TODAS as policies.
-- SECURITY DEFINER: ignora RLS ao consultar public.users, evitando recursão.
create or replace function public.is_member()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.users u where u.id = auth.uid());
$$;

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

-- 4.2 Allowlist: bloqueia criação de conta fora da lista e cria o perfil.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select a.full_name into v_name
  from public.allowlist a
  where a.email = lower(new.email);

  if v_name is null then
    raise exception 'E-mail % nao autorizado para este grupo.', new.email
      using errcode = '42501';
  end if;

  insert into public.users (id, email, full_name)
  values (new.id, lower(new.email), v_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- 4.3 updated_at automático
create trigger set_updated_at before update on public.users
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger set_updated_at before update on public.trip_settings
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger set_updated_at before update on public.notices
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger set_updated_at before update on public.rent_installments
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger set_updated_at before update on public.common_fund_transactions
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger set_updated_at before update on public.shopping_list
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger set_updated_at before update on public.feed_posts
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger set_updated_at before update on public.quotes
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger set_updated_at before update on public.comments
  for each row execute procedure extensions.moddatetime (updated_at);
create trigger set_updated_at before update on public.schedule
  for each row execute procedure extensions.moddatetime (updated_at);

-- 4.4 Baixa de parcela: carimba timestamp e quem confirmou (server-side).
create or replace function public.tg_rent_mark_paid()
returns trigger
language plpgsql
as $$
begin
  if new.paid is true and old.paid is false then
    new.paid_at      := coalesce(new.paid_at, now());
    new.confirmed_by := coalesce(new.confirmed_by, auth.uid());
  elsif new.paid is false and old.paid is true then
    new.paid_at      := null;
    new.confirmed_by := null;
  end if;
  return new;
end;
$$;

create trigger rent_mark_paid before update on public.rent_installments
  for each row execute function public.tg_rent_mark_paid();

-- 4.5 Check da lista de compras: mesma lógica.
create or replace function public.tg_shopping_mark_checked()
returns trigger
language plpgsql
as $$
begin
  if new.checked is true and old.checked is false then
    new.checked_by := coalesce(new.checked_by, auth.uid());
    new.checked_at := coalesce(new.checked_at, now());
  elsif new.checked is false and old.checked is true then
    new.checked_by := null;
    new.checked_at := null;
  end if;
  return new;
end;
$$;

create trigger shopping_mark_checked before update on public.shopping_list
  for each row execute function public.tg_shopping_mark_checked();

-- 4.6 Geração das parcelas do aluguel.
-- Divide o total por N pessoas e por N meses; o resíduo dos centavos
-- vai para a última parcela de cada um.
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
  v_user        record;
  v_months      integer;
  v_per_member  numeric(12,2);
  v_per_month   numeric(12,2);
  v_accumulated numeric(12,2);
  v_amount      numeric(12,2);
  v_month       date;
  v_i           integer;
  v_count       integer := 0;
  v_members     integer;
begin
  if not public.is_member() then
    raise exception 'Apenas membros podem gerar parcelas.' using errcode = '42501';
  end if;

  p_first_month := date_trunc('month', p_first_month)::date;
  p_last_month  := date_trunc('month', p_last_month)::date;

  v_months := (extract(year from p_last_month) - extract(year from p_first_month)) * 12
            + (extract(month from p_last_month) - extract(month from p_first_month)) + 1;

  if v_months < 1 then
    raise exception 'Periodo invalido.';
  end if;

  select count(*) into v_members from public.users;
  if v_members = 0 then
    raise exception 'Nenhum usuario cadastrado.';
  end if;

  v_per_member := round(p_total / v_members, 2);
  v_per_month  := round(v_per_member / v_months, 2);

  for v_user in select id from public.users loop
    v_accumulated := 0;
    for v_i in 0 .. v_months - 1 loop
      v_month := (p_first_month + (v_i || ' month')::interval)::date;
      if v_i = v_months - 1 then
        v_amount := v_per_member - v_accumulated;      -- ajusta o resíduo
      else
        v_amount := v_per_month;
        v_accumulated := v_accumulated + v_per_month;
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

-- ---------------------------------------------------------------------
-- 5. VIEWS (security_invoker = respeitam as RLS de quem consulta)
-- ---------------------------------------------------------------------
create view public.v_common_fund_balance with (security_invoker = on) as
select
  coalesce(sum(amount) filter (where type = 'entrada'), 0)                     as total_in,
  coalesce(sum(amount) filter (where type = 'saida'),   0)                     as total_out,
  coalesce(sum(case when type = 'entrada' then amount else -amount end), 0)    as balance
from public.common_fund_transactions;

create view public.v_member_fund_summary with (security_invoker = on) as
select
  u.id                                                                          as user_id,
  u.full_name,
  coalesce(sum(t.amount) filter (where t.type = 'entrada'), 0)                   as contributed,
  coalesce(sum(t.amount) filter (where t.type = 'saida'),   0)                   as spent_on_behalf
from public.users u
left join public.common_fund_transactions t on t.member_id = u.id
group by u.id, u.full_name;

create view public.v_rent_summary with (security_invoker = on) as
select
  u.id                                                            as user_id,
  u.full_name,
  count(r.id)                                                     as installments,
  count(r.id) filter (where r.paid)                               as installments_paid,
  coalesce(sum(r.amount), 0)                                      as total_due,
  coalesce(sum(r.amount) filter (where r.paid), 0)                as total_paid,
  coalesce(sum(r.amount) filter (where not r.paid), 0)            as total_open,
  min(r.due_date) filter (where not r.paid)                       as next_due_date
from public.users u
left join public.rent_installments r on r.user_id = u.id
group by u.id, u.full_name;

-- ---------------------------------------------------------------------
-- 6. RLS — nada é legível anonimamente; tudo exige is_member()
-- ---------------------------------------------------------------------
alter table public.allowlist                enable row level security;
alter table public.users                    enable row level security;
alter table public.trip_settings            enable row level security;
alter table public.notices                  enable row level security;
alter table public.rent_installments        enable row level security;
alter table public.common_fund_transactions enable row level security;
alter table public.shopping_list            enable row level security;
alter table public.albums                   enable row level security;
alter table public.feed_posts               enable row level security;
alter table public.feed_media               enable row level security;
alter table public.photo_tags               enable row level security;
alter table public.quotes                   enable row level security;
alter table public.comments                 enable row level security;
alter table public.reactions                enable row level security;
alter table public.schedule                 enable row level security;
alter table public.roulette_draws           enable row level security;
alter table public.roulette_results         enable row level security;

-- 6.1 allowlist: ninguém acessa pelo client (só o trigger, que é definer).
--     Sem policies = tabela fechada mesmo para authenticated.

-- 6.2 users
create policy users_select on public.users
  for select to authenticated using (public.is_member());
create policy users_update_self on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- insert/delete apenas via trigger (security definer). Sem policy = bloqueado.

-- 6.3 trip_settings (grupo todo admin)
create policy trip_settings_select on public.trip_settings
  for select to authenticated using (public.is_member());
create policy trip_settings_update on public.trip_settings
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy trip_settings_insert on public.trip_settings
  for insert to authenticated with check (public.is_member());

-- 6.4 notices
create policy notices_select on public.notices
  for select to authenticated using (public.is_member());
create policy notices_insert on public.notices
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy notices_update on public.notices
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy notices_delete on public.notices
  for delete to authenticated using (created_by = auth.uid());

-- 6.5 rent_installments
--     Leitura: todo mundo vê a situação de todo mundo (transparência).
--     Escrita: cada um dá baixa APENAS na própria parcela.
--     (Para permitir baixa cruzada, troque o using por public.is_member().)
create policy rent_select on public.rent_installments
  for select to authenticated using (public.is_member());
create policy rent_update_own on public.rent_installments
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rent_insert on public.rent_installments
  for insert to authenticated with check (public.is_member());
create policy rent_delete on public.rent_installments
  for delete to authenticated using (public.is_member());

-- 6.6 common_fund_transactions
create policy fund_select on public.common_fund_transactions
  for select to authenticated using (public.is_member());
create policy fund_insert on public.common_fund_transactions
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy fund_update on public.common_fund_transactions
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy fund_delete on public.common_fund_transactions
  for delete to authenticated using (created_by = auth.uid());

-- 6.7 shopping_list (qualquer membro cria, marca e remove item)
create policy shopping_select on public.shopping_list
  for select to authenticated using (public.is_member());
create policy shopping_insert on public.shopping_list
  for insert to authenticated with check (public.is_member() and added_by = auth.uid());
create policy shopping_update on public.shopping_list
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy shopping_delete on public.shopping_list
  for delete to authenticated using (public.is_member());

-- 6.8 albums / feed_posts / feed_media / photo_tags
create policy albums_select on public.albums
  for select to authenticated using (public.is_member());
create policy albums_insert on public.albums
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy albums_update on public.albums
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy albums_delete on public.albums
  for delete to authenticated using (created_by = auth.uid());

create policy posts_select on public.feed_posts
  for select to authenticated using (public.is_member());
create policy posts_insert on public.feed_posts
  for insert to authenticated with check (public.is_member() and author_id = auth.uid());
create policy posts_update_own on public.feed_posts
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete_own on public.feed_posts
  for delete to authenticated using (author_id = auth.uid());

create policy media_select on public.feed_media
  for select to authenticated using (public.is_member());
create policy media_insert on public.feed_media
  for insert to authenticated with check (
    exists (select 1 from public.feed_posts p where p.id = post_id and p.author_id = auth.uid())
  );
create policy media_delete on public.feed_media
  for delete to authenticated using (
    exists (select 1 from public.feed_posts p where p.id = post_id and p.author_id = auth.uid())
  );

create policy tags_select on public.photo_tags
  for select to authenticated using (public.is_member());
create policy tags_insert on public.photo_tags
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy tags_delete on public.photo_tags
  for delete to authenticated using (created_by = auth.uid() or user_id = auth.uid());

-- 6.9 quotes
create policy quotes_select on public.quotes
  for select to authenticated using (public.is_member());
create policy quotes_insert on public.quotes
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy quotes_update on public.quotes
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy quotes_delete on public.quotes
  for delete to authenticated using (created_by = auth.uid() or author_id = auth.uid());

-- 6.10 comments / reactions
create policy comments_select on public.comments
  for select to authenticated using (public.is_member());
create policy comments_insert on public.comments
  for insert to authenticated with check (public.is_member() and author_id = auth.uid());
create policy comments_update_own on public.comments
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_delete_own on public.comments
  for delete to authenticated using (author_id = auth.uid());

create policy reactions_select on public.reactions
  for select to authenticated using (public.is_member());
create policy reactions_insert on public.reactions
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy reactions_delete_own on public.reactions
  for delete to authenticated using (user_id = auth.uid());

-- 6.11 schedule (edição colaborativa)
create policy schedule_select on public.schedule
  for select to authenticated using (public.is_member());
create policy schedule_insert on public.schedule
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy schedule_update on public.schedule
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy schedule_delete on public.schedule
  for delete to authenticated using (public.is_member());

-- 6.12 roleta (histórico imutável: sem update)
create policy draws_select on public.roulette_draws
  for select to authenticated using (public.is_member());
create policy draws_insert on public.roulette_draws
  for insert to authenticated with check (public.is_member() and drawn_by = auth.uid());
create policy draws_delete on public.roulette_draws
  for delete to authenticated using (drawn_by = auth.uid());

create policy results_select on public.roulette_results
  for select to authenticated using (public.is_member());
create policy results_insert on public.roulette_results
  for insert to authenticated with check (
    exists (select 1 from public.roulette_draws d where d.id = draw_id and d.drawn_by = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 7. REALTIME
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.shopping_list;
alter publication supabase_realtime add table public.common_fund_transactions;
alter publication supabase_realtime add table public.rent_installments;
alter publication supabase_realtime add table public.feed_posts;
alter publication supabase_realtime add table public.feed_media;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.quotes;
alter publication supabase_realtime add table public.schedule;
alter publication supabase_realtime add table public.roulette_draws;
alter publication supabase_realtime add table public.roulette_results;
alter publication supabase_realtime add table public.notices;

-- Necessário para receber o registro completo em UPDATE/DELETE.
alter table public.shopping_list            replica identity full;
alter table public.rent_installments        replica identity full;
alter table public.common_fund_transactions replica identity full;
alter table public.schedule                 replica identity full;

-- ---------------------------------------------------------------------
-- 8. STORAGE (buckets privados + policies)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('photos',   'photos',   false),
  ('receipts', 'receipts', false),
  ('avatars',  'avatars',  false)
on conflict (id) do nothing;

create policy storage_read_members on storage.objects
  for select to authenticated
  using (bucket_id in ('photos','receipts','avatars') and public.is_member());

create policy storage_insert_members on storage.objects
  for insert to authenticated
  with check (bucket_id in ('photos','receipts','avatars') and public.is_member());

create policy storage_update_owner on storage.objects
  for update to authenticated
  using (bucket_id in ('photos','receipts','avatars') and owner = auth.uid())
  with check (bucket_id in ('photos','receipts','avatars') and owner = auth.uid());

create policy storage_delete_owner on storage.objects
  for delete to authenticated
  using (bucket_id in ('photos','receipts','avatars') and owner = auth.uid());

-- =====================================================================
-- FIM
-- =====================================================================
