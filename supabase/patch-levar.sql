-- =====================================================================
--  LEVAR — lista de "quem leva o quê"
--  Reaproveita a tabela shopping_list, so acrescentando o responsavel.
--  Rode no SQL Editor.
-- =====================================================================

alter table public.shopping_list
  add column if not exists assigned_to uuid references public.users(id) on delete set null;

create index if not exists shopping_list_assigned_idx
  on public.shopping_list (assigned_to);

-- Os campos de mercado (categoria, quantidade, unidade, custo) continuam
-- existindo com valores padrao. A tela nao usa nenhum deles.
