"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { Segmented } from "@/components/financeiro/segmented";
import type { Member } from "@/types/app";

type Item = {
  id: string;
  title: string;
  checked: boolean;
  added_by: string;
  assigned_to: string | null;
  checked_by: string | null;
};

type Filtro = "todos" | "meus";

const SEM_DONO = "__sem_dono__";

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 animate-pulse rounded-2xl bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export function LevarList({ userId, membros }: { userId: string; membros: Member[] }) {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [texto, setTexto] = useState("");
  const [dono, setDono] = useState<string>(userId);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("shopping_list")
      .select("id, title, checked, added_by, assigned_to, checked_by")
      .order("created_at");
    setItens((data as Item[] | null) ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useRealtime(["shopping_list"], carregar);

  const nome = useCallback(
    (id: string | null) => {
      if (!id) return "A definir";
      const m = membros.find((x) => x.id === id);
      if (!m) return "Alguém";
      return m.id === userId ? "Você" : (m.nickname || m.full_name).split(" ")[0];
    },
    [membros, userId],
  );

  /** Agrupa por responsável, com "a definir" sempre no fim. */
  const grupos = useMemo(() => {
    const base = itens ?? [];
    const visiveis = filtro === "meus" ? base.filter((i) => i.assigned_to === userId) : base;

    const mapa = new Map<string, Item[]>();
    visiveis.forEach((i) => {
      const chave = i.assigned_to ?? SEM_DONO;
      const lista = mapa.get(chave) ?? [];
      lista.push(i);
      mapa.set(chave, lista);
    });

    return Array.from(mapa.entries()).sort(([a], [b]) => {
      if (a === SEM_DONO) return 1;
      if (b === SEM_DONO) return -1;
      if (a === userId) return -1;
      if (b === userId) return 1;
      return nome(a).localeCompare(nome(b));
    });
  }, [itens, filtro, userId, nome]);

  async function adicionar() {
    const t = texto.trim();
    if (t.length < 2) return;

    setSalvando(true);
    const supabase = createClient();

    const { error } = await supabase.from("shopping_list").insert({
      title: t,
      added_by: userId,
      assigned_to: dono === SEM_DONO ? null : dono,
    });

    setSalvando(false);

    if (error) {
      toast.error("Não deu para adicionar", { description: error.message });
      return;
    }

    setTexto("");
    carregar();
  }

  async function alternar(item: Item) {
    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_list")
      .update({ checked: !item.checked })
      .eq("id", item.id);

    if (error) {
      toast.error("Não deu para atualizar", { description: error.message });
      return;
    }
    carregar();
  }

  async function trocarDono(item: Item, novo: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_list")
      .update({ assigned_to: novo === SEM_DONO ? null : novo })
      .eq("id", item.id);

    if (error) {
      toast.error("Não deu para mudar o responsável", { description: error.message });
      return;
    }
    carregar();
  }

  async function remover(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("shopping_list").delete().eq("id", id);

    if (error) {
      toast.error("Não deu para apagar", { description: error.message });
      return;
    }
    toast.success("Item removido");
    carregar();
  }

  if (itens === null) return <Skeleton />;

  const total = itens.length;
  const prontos = itens.filter((i) => i.checked).length;

  return (
    <div className="space-y-5">
      {/* Adicionar */}
      <div className="card-soft space-y-3 p-4">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") adicionar();
          }}
          placeholder="Caixinha de som, carvão, baralho..."
          aria-label="O que precisa levar"
          className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none transition focus:border-accent"
        />

        <div className="flex gap-2">
          <select
            value={dono}
            onChange={(e) => setDono(e.target.value)}
            aria-label="Quem leva"
            className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-accent"
          >
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {nome(m.id)}
              </option>
            ))}
            <option value={SEM_DONO}>A definir</option>
          </select>

          <button
            onClick={adicionar}
            disabled={texto.trim().length < 2 || salvando}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </button>
        </div>
      </div>

      {total > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="shrink-0 text-sm text-muted-foreground">
              {prontos} de {total} na mala
            </p>
            <div className="w-44">
              <Segmented<Filtro>
                layoutId="filtro-levar"
                value={filtro}
                onChange={setFiltro}
                options={[
                  { value: "todos", label: "Todos" },
                  { value: "meus", label: "Meus" },
                ]}
              />
            </div>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${(prontos / total) * 100}%` }}
            />
          </div>
        </>
      )}

      {total === 0 ? (
        <div className="card-soft space-y-2 p-8 text-center">
          <UserRound className="mx-auto h-10 w-10 text-muted-foreground/40" aria-hidden />
          <p className="font-display font-semibold">Nada na lista ainda</p>
          <p className="text-sm text-muted-foreground">
            Adicione o que não pode faltar e diga quem fica de levar.
          </p>
        </div>
      ) : grupos.length === 0 ? (
        <div className="card-soft p-8 text-center text-sm text-muted-foreground">
          Você não ficou de levar nada ainda.
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map(([chave, lista]) => {
            const feitos = lista.filter((i) => i.checked).length;

            return (
              <section key={chave}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {chave === SEM_DONO ? "A definir" : nome(chave)}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {feitos}/{lista.length}
                  </span>
                </div>

                <ul className="card-soft divide-y divide-border/60 overflow-hidden">
                  {lista.map((item) => (
                    <li key={item.id} className="group flex items-center gap-3 p-3.5">
                      <button
                        onClick={() => alternar(item)}
                        aria-label={item.checked ? "Desmarcar" : "Marcar como separado"}
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition ${
                          item.checked
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border text-transparent hover:border-accent"
                        }`}
                      >
                        <Check className="h-4 w-4" aria-hidden />
                      </button>

                      <span
                        className={`min-w-0 flex-1 truncate ${
                          item.checked ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {item.title}
                      </span>

                      <select
                        value={item.assigned_to ?? SEM_DONO}
                        onChange={(e) => trocarDono(item, e.target.value)}
                        aria-label={`Quem leva ${item.title}`}
                        className="h-8 shrink-0 rounded-lg border border-border bg-card px-2 text-xs outline-none focus:border-accent"
                      >
                        {membros.map((m) => (
                          <option key={m.id} value={m.id}>
                            {nome(m.id)}
                          </option>
                        ))}
                        <option value={SEM_DONO}>A definir</option>
                      </select>

                      <button
                        onClick={() => remover(item.id)}
                        aria-label={`Apagar ${item.title}`}
                        className="shrink-0 text-muted-foreground/40 transition hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
