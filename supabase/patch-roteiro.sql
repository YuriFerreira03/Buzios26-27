-- =====================================================================
--  ROTEIRO — presenca por atividade
--  A tabela schedule ja existe desde o schema inicial. O que falta e
--  saber QUEM topa cada coisa: numa viagem de grupo, a informacao que
--  importa nao e so "as 14h tem escuna", e "quem vai na escuna".
--  Rode INTEIRO no SQL Editor.
-- =====================================================================

create table if not exists public.schedule_attendance (
  id          uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedule(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (schedule_id, user_id)
);

create index if not exists schedule_attendance_item_idx
  on public.schedule_attendance (schedule_id);

alter table public.schedule_attendance enable row level security;

drop policy if exists attendance_select on public.schedule_attendance;
create policy attendance_select on public.schedule_attendance
  for select to authenticated using (public.is_member());

-- Voce marca presenca so por voce mesmo.
drop policy if exists attendance_insert on public.schedule_attendance;
create policy attendance_insert on public.schedule_attendance
  for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());

drop policy if exists attendance_delete on public.schedule_attendance;
create policy attendance_delete on public.schedule_attendance
  for delete to authenticated using (user_id = auth.uid());

do $$
begin
  begin alter publication supabase_realtime add table public.schedule_attendance;
  exception when duplicate_object then null; end;
end $$;

alter table public.schedule_attendance replica identity full;
