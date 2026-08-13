"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Receipt, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/utils";
import { paraCentavos, paraReais } from "@/lib/split";
import { BotaoNovaDespesa, ExpenseDialog } from "./expense-dialog";
import { CATEGORIAS, type Member } from "@/types/app";
import type { Expense, ExpenseSplit } from "@/types/grana";

const rotuloCategoria = (v: string) => CATEGORIAS.find((c) => c.value === v)?.label ?? v;

function dataLonga(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 animate-pulse rounded-2xl bg-muted" />
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export function ExpensesPanel({
  userId,
  membros,
  despesas,
  divisoes,
  recarregar,
}: {
  userId: string;
  membros: Member[];
  despesas: Expense[] | null;
  divisoes: ExpenseSplit[];
  recarregar: () => void;
}) {
  const [dialogo, setDialogo] = useState<{ aberto: boolean; despesa: Expense | null }>({
    aberto: false,
    despesa: null,
  });
  const [expandida, setExpandida] = useState<string | null>(null);

  if (despesas === null) return <Skeleton />;

  const nome = (id: string) => {
    const m = membros.find((x) => x.id === id);
    if (!m) return "Alguém";
    return m.id === userId ? "Você" : (m.nickname || m.full_name).split(" ")[0];
  };

  async function remover(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      toast.error("Não deu para apagar", {
        description: "Só quem lançou ou quem pagou pode remover.",
      });
      return;
    }
    toast.success("Despesa removida");
    recarregar();
  }

  /** Quanto esta despesa mexeu no seu bolso: positivo = emprestou, negativo = deve. */
  function seuImpacto(e: Expense) {
    const minhaParte = divisoes
      .filter((d) => d.expense_id === e.id && d.user_id === userId)
      .reduce((s, d) => s + paraCentavos(d.share), 0);

    const pagou = e.paid_by === userId ? paraCentavos(e.amount) : 0;
    return pagou - minhaParte;
  }

  const grupos = despesas.reduce<Record<string, Expense[]>>((acc, e) => {
    (acc[e.occurred_at] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <BotaoNovaDespesa onClick={() => setDialogo({ aberto: true, despesa: null })} />

      {despesas.length === 0 ? (
        <div className="card-soft space-y-2 p-8 text-center">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground/40" aria-hidden />
          <p className="font-display font-semibold">Nenhuma despesa ainda</p>
          <p className="text-sm text-muted-foreground">
            Lance o primeiro gasto e o app calcula quem deve quanto para quem.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grupos).map(([dia, itens]) => (
            <section key={dia}>
              <p className="mb-2 px-1 text-xs uppercase tracking-wider text-muted-foreground">
                {dataLonga(dia)}
              </p>

              <ul className="card-soft divide-y divide-border/60 overflow-hidden">
                {itens.map((e) => {
                  const impacto = seuImpacto(e);
                  const aberta = expandida === e.id;
                  const partes = divisoes.filter((d) => d.expense_id === e.id);

                  return (
                    <li key={e.id}>
                      <button
                        onClick={() => setExpandida(aberta ? null : e.id)}
                        aria-expanded={aberta}
                        className="flex w-full items-center gap-3 p-4 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{e.description}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {nome(e.paid_by)} pagou {brl(e.amount)} · {rotuloCategoria(e.category)}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          {impacto > 0 ? (
                            <>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                emprestou
                              </p>
                              <p className="font-display font-semibold tabular-nums text-secondary">
                                {brl(paraReais(impacto))}
                              </p>
                            </>
                          ) : impacto < 0 ? (
                            <>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                você deve
                              </p>
                              <p className="font-display font-semibold tabular-nums text-destructive">
                                {brl(paraReais(-impacto))}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">fora dessa</p>
                          )}
                        </div>
                      </button>

                      {aberta && (
                        <div className="border-t border-border/60 bg-muted/30 px-4 py-3">
                          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                            Divisão
                          </p>
                          <ul className="space-y-1.5">
                            {partes.map((p) => (
                              <li key={p.id} className="flex justify-between text-sm">
                                <span>{nome(p.user_id)}</span>
                                <span className="tabular-nums text-muted-foreground">
                                  {brl(p.share)}
                                </span>
                              </li>
                            ))}
                          </ul>

                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => setDialogo({ aberto: true, despesa: e })}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                              Editar
                            </button>

                            {(e.created_by === userId || e.paid_by === userId) && (
                              <button
                                onClick={() => remover(e.id)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                Apagar
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {dialogo.aberto && (
        <ExpenseDialog
          userId={userId}
          membros={membros}
          aberta={dialogo.despesa}
          divisoes={divisoes}
          onClose={() => setDialogo({ aberto: false, despesa: null })}
          onDone={recarregar}
        />
      )}
    </div>
  );
}
