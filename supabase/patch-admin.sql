-- =====================================================================
--  ADMIN — aprovar membros pela tela, sem abrir o painel do Supabase
--
--  A aprovacao NAO passa por permissao de coluna: se "approved" fosse
--  gravavel, um usuario pendente aprovaria a si mesmo (a linha e dele).
--  Toda mudanca passa por set_user_approval, que confere is_admin().
--  Rode INTEIRO no SQL Editor.
-- =====================================================================

alter table public.users
  add column if not exists is_admin boolean not null default false;

-- O e-mail ja entra aprovado quando fizer o primeiro login.
insert into public.allowlist (email, full_name)
values ('yurimoreiraferreira722@gmail.com', 'Yuri Ferreira')
on conflict (email) do update set full_name = excluded.full_name;

-- Marca como admin (so tem efeito se a conta ja existir; veja a nota final).
update public.users
   set is_admin = true, approved = true
 where email = 'yurimoreiraferreira722@gmail.com';

-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.approved and u.is_admin
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
create or replace function public.set_user_approval(
  p_user_id  uuid,
  p_approved boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem aprovar membros.' using errcode = '42501';
  end if;

  -- Trava contra o tiro no pe: nao da para se auto-remover do grupo.
  if p_user_id = auth.uid() and not p_approved then
    raise exception 'Voce nao pode remover o proprio acesso.';
  end if;

  update public.users set approved = p_approved where id = p_user_id;
end;
$$;

grant execute on function public.set_user_approval(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Realtime na lista de membros: pedido novo aparece sem recarregar.
do $$
begin
  begin alter publication supabase_realtime add table public.users;
  exception when duplicate_object then null; end;
end $$;

alter table public.users replica identity full;

-- =====================================================================
--  NOTA: se a conta yurimoreiraferreira722@gmail.com ainda nao existe,
--  o UPDATE acima nao pegou. Faca o login com ela uma vez e rode:
--
--    update public.users
--       set is_admin = true, approved = true
--     where email = 'yurimoreiraferreira722@gmail.com';
-- =====================================================================
