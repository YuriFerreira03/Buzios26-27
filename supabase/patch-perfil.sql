-- =====================================================================
--  PERFIL + LOGIN COM GOOGLE
--
--  O Google manda o nome em "full_name" ou "name" e a foto em
--  "avatar_url". O trigger antigo so olhava "full_name", entao quem
--  entrasse pelo Google podia acabar com o nome vazio.
--  Rode INTEIRO no SQL Editor.
-- =====================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow  text;
  v_nome   text;
  v_avatar text;
begin
  select a.full_name into v_allow
  from public.allowlist a
  where a.email = lower(new.email);

  -- Ordem de preferencia: allowlist -> metadata do provedor -> antes do @
  v_nome := coalesce(
    v_allow,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    initcap(replace(split_part(new.email, '@', 1), '.', ' '))
  );

  v_avatar := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture'
  )), '');

  insert into public.users (id, email, full_name, avatar_path, approved)
  values (new.id, lower(new.email), v_nome, v_avatar, v_allow is not null)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Garante que o perfil so pode editar os campos permitidos.
-- (Se ja rodou o patch de aprovacao, isto e apenas reafirmacao.)
revoke update on public.users from authenticated;
grant update (full_name, nickname, avatar_path, phone, pix_key)
  on public.users to authenticated;
