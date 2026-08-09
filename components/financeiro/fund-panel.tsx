"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { brl } from "@/lib/utils";
import { TransactionDialog } from "./transaction-dialog";
import { CATEGORIAS, type FundTransaction, type Member } from "@/types/app";

const rotuloCategoria = (v: string) => CATEGORIAS.find((c) => c.value === v)?.label ?? v;

function dataLonga(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      <div className="h-12 animate-pulse rounded-2xl bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export function FundPanel({ userId, membros }: { userId: string; membros: Member[] }) {
  const [txs, setTxs] = useState<FundTransaction[] | null>(null);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("common_fund_transactions")
      .select("*")
      .order("occurred_at", { ascending: false });
    setTxs((data as FundTransaction[] | null) ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useRealtime(["common_fund_transactions"], carregar);

  async function remover(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("common_fund_transactions").delete().eq("id", id);
    if (error) {
      toast.error("Não deu para apagar", { description: "Só quem registrou pode remover." });
      return;
    }
    toast.success("Movimento removido");
    carregar();
  }

  if (txs === null) return <Skeleton />;

  const nome = (id: string) => {
    const m = membros.find((x) => x.id === id);
    return m ? (m.nickname || m.full_name).split(" ")[0] : "—";
  };

  const entrada = txs.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const saida = txs.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const saldo = entrada - saida;

  const porPessoa = membros
    .map((m) => ({
      membro: m,
      valor: txs
        .filter((t) => t.type === "entrada" && t.member_id === m.id)
        .reduce((s, t) => s + Number(t.amount), 0),
    }))
    .sort((a, b) => b.valor - a.valor);

  const maior = Math.max(...porPessoa.map((p) => p.valor), 1);

  // Agrupa por dia
  const grupos = txs.reduce<Record<string, FundTransaction[]>>((acc, t) => {
    const dia = t.occurred_at.slice(0, 10);
    (acc[dia] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Saldo */}
      <section className="card-soft p-5">
        <p className="text-sm text-muted-foreground">Saldo disponível</p>
        <p className="mt-1 font-display text-[34px] font-bold leading-none text-primary">
          {brl(saldo)}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/60 p-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowUpRight className="h-3.5 w-3.5 text-secondary" aria-hidden />
              Entradas
            </span>
            <p className="mt-1 font-display font-semibold tabular-nums">{brl(entrada)}</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowDownRight className="h-3.5 w-3.5 text-accent" aria-hidden />
              Saídas
            </span>
            <p className="mt-1 font-display font-semibold tabular-nums">{brl(saida)}</p>
          </div>
        </div>
      </section>

      <TransactionDialog userId={userId} membros={membros} onDone={carregar} />

      {/* Contribuicao por pessoa */}
      {entrada > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Quem colocou quanto
          </h2>
          <ul className="card-soft space-y-3 p-4">
            {porPessoa.map(({ membro, valor }) => (
              <li key={membro.id} className="flex items-center gap-3">
                <span className="w-20 shrink-0 truncate text-sm">
                  {(membro.nickname || membro.full_name).split(" ")[0]}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-secondary transition-all duration-500"
                    style={{ width: `${(valor / maior) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                  {brl(valor)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Extrato */}
      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Extrato
        </h2>

        {txs.length === 0 ? (
          <div className="card-soft p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nada registrado ainda. Comece lançando a primeira contribuição da caixinha.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grupos).map(([dia, itens]) => (
              <div key={dia}>
                <p className="mb-2 px-1 text-xs uppercase tracking-wider text-muted-foreground">
                  {dataLonga(`${dia}T12:00:00`)}
                </p>

                <ul className="card-soft divide-y divide-border/60 overflow-hidden">
                  {itens.map((t) => {
                    const isEntrada = t.type === "entrada";
                    return (
                      <li key={t.id} className="group flex items-center gap-3 p-4">
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                            isEntrada ? "bg-secondary/10" : "bg-accent/15"
                          }`}
                        >
                          {isEntrada ? (
                            <ArrowUpRight className="h-4 w-4 text-secondary" aria-hidden />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-accent" aria-hidden />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{t.description}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {nome(t.member_id)} · {rotuloCategoria(t.category)}
                          </p>
                        </div>

                        <p
                          className={`shrink-0 font-display font-semibold tabular-nums ${
                            isEntrada ? "text-secondary" : "text-foreground"
                          }`}
                        >
                          {isEntrada ? "+" : "−"} {brl(t.amount)}
                        </p>

                        {t.created_by === userId && (
                          <button
                            onClick={() => remover(t.id)}
                            aria-label="Remover movimento"
                            className="shrink-0 text-muted-foreground/40 transition hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
