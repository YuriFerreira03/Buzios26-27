"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Handshake, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/utils";
import {
  calcularSaldos,
  dividasPorPar,
  paraCentavos,
  paraReais,
  simplificarDividas,
  type Transferencia,
} from "@/lib/split";
import { Segmented } from "./segmented";
import { SettleDialog } from "./settle-dialog";
import type { Member } from "@/types/app";
import type { Expense, ExpenseSplit, Settlement } from "@/types/grana";

type Modo = "real" | "simplificado";

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      <div className="h-56 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export function BalancesPanel({
  userId,
  membros,
  despesas,
  divisoes,
  acertos,
  recarregar,
}: {
  userId: string;
  membros: Member[];
  despesas: Expense[] | null;
  divisoes: ExpenseSplit[];
  acertos: Settlement[];
  recarregar: () => void;
}) {
  const [modo, setModo] = useState<Modo>("real");
  const [dialogo, setDialogo] = useState<Transferencia | null>(null);
  const [dialogoAberto, setDialogoAberto] = useState(false);

  const calc = useMemo(() => {
    const d = (despesas ?? []).map((e) => ({
      id: e.id,
      amount: paraCentavos(e.amount),
      paid_by: e.paid_by,
    }));
    const s = divisoes.map((x) => ({
      expense_id: x.expense_id,
      user_id: x.user_id,
      share: paraCentavos(x.share),
    }));
    const a = acertos.map((x) => ({
      from_user: x.from_user,
      to_user: x.to_user,
      amount: paraCentavos(x.amount),
    }));

    const saldos = calcularSaldos(membros.map((m) => m.id), d, s, a);

    return {
      saldos,
      reais: dividasPorPar(d, s, a),
      simplificadas: simplificarDividas(saldos),
    };
  }, [despesas, divisoes, acertos, membros]);

  if (despesas === null) return <Skeleton />;

  const nome = (id: string) => {
    const m = membros.find((x) => x.id === id);
    if (!m) return "Alguém";
    return (m.nickname || m.full_name).split(" ")[0];
  };

  const meuSaldo = calc.saldos[userId] ?? 0;
  const lista = modo === "real" ? calc.reais : calc.simplificadas;
  const minhas = lista.filter((t) => t.from === userId || t.to === userId);
  const outras = lista.filter((t) => t.from !== userId && t.to !== userId);

  async function apagarAcerto(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("settlements").delete().eq("id", id);
    if (error) {
      toast.error("Não deu para apagar o acerto", { description: error.message });
      return;
    }
    toast.success("Acerto removido");
    recarregar();
  }

  function abrir(t?: Transferencia) {
    setDialogo(t ?? null);
    setDialogoAberto(true);
  }

  return (
    <div className="space-y-6">
      {/* Seu saldo geral */}
      <section className="card-soft p-5">
        <p className="text-sm text-muted-foreground">No geral</p>
        {meuSaldo > 0 ? (
          <>
            <p className="mt-1 font-display text-[32px] font-bold leading-none text-secondary">
              {brl(paraReais(meuSaldo))}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">é o que o grupo te deve</p>
          </>
        ) : meuSaldo < 0 ? (
          <>
            <p className="mt-1 font-display text-[32px] font-bold leading-none text-destructive">
              {brl(paraReais(-meuSaldo))}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">é o que você deve ao grupo</p>
          </>
        ) : (
          <>
            <p className="mt-1 font-display text-[32px] font-bold leading-none text-primary">
              Tudo certo
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">ninguém deve nada a ninguém</p>
          </>
        )}
      </section>

      <Segmented<Modo>
        layoutId="modo-saldo"
        value={modo}
        onChange={setModo}
        options={[
          { value: "real", label: "Dívidas reais" },
          { value: "simplificado", label: "Simplificado" },
        ]}
      />

      {modo === "simplificado" && (
        <p className="-mt-3 px-1 text-xs text-muted-foreground">
          Mesmos saldos finais, menos transferências: o maior devedor paga direto o maior credor.
        </p>
      )}

      {/* Suas pendencias */}
      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Suas contas
        </h2>

        {minhas.length === 0 ? (
          <div className="card-soft p-6 text-center text-sm text-muted-foreground">
            Você está quitado com todo mundo.
          </div>
        ) : (
          <ul className="card-soft divide-y divide-border/60 overflow-hidden">
            {minhas.map((t, i) => {
              const euDevo = t.from === userId;
              return (
                <li key={`${t.from}-${t.to}-${i}`} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {euDevo ? (
                        <>
                          Você deve a <span className="font-medium">{nome(t.to)}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium">{nome(t.from)}</span> te deve
                        </>
                      )}
                    </p>
                    <p
                      className={`mt-0.5 font-display text-lg font-semibold tabular-nums ${
                        euDevo ? "text-destructive" : "text-secondary"
                      }`}
                    >
                      {brl(paraReais(t.amount))}
                    </p>
                  </div>

                  <button
                    onClick={() => abrir(t)}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
                  >
                    <Handshake className="h-3.5 w-3.5" aria-hidden />
                    Acertar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Dividas entre os outros */}
      {outras.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Entre os outros
          </h2>
          <ul className="card-soft divide-y divide-border/60 overflow-hidden">
            {outras.map((t, i) => (
              <li
                key={`${t.from}-${t.to}-${i}`}
                className="flex items-center gap-2 p-4 text-sm"
              >
                <span className="font-medium">{nome(t.from)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <span className="font-medium">{nome(t.to)}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {brl(paraReais(t.amount))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        onClick={() => abrir()}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-semibold transition active:scale-[0.99]"
      >
        <Handshake className="h-4 w-4" aria-hidden />
        Registrar acerto manual
      </button>

      {/* Historico */}
      {acertos.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Acertos registrados
          </h2>
          <ul className="card-soft divide-y divide-border/60 overflow-hidden">
            {acertos.map((a) => (
              <li key={a.id} className="flex items-center gap-2 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-medium">{nome(a.from_user)}</span> pagou{" "}
                    <span className="font-medium">{nome(a.to_user)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(`${a.occurred_at}T12:00:00`).toLocaleDateString("pt-BR")}
                    {a.note ? ` · ${a.note}` : ""}
                  </p>
                </div>

                <span className="shrink-0 tabular-nums">{brl(a.amount)}</span>

                <button
                  onClick={() => apagarAcerto(a.id)}
                  aria-label="Apagar acerto"
                  className="shrink-0 text-muted-foreground/40 transition hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dialogoAberto && (
        <SettleDialog
          userId={userId}
          membros={membros}
          sugestao={dialogo}
          onClose={() => setDialogoAberto(false)}
          onDone={recarregar}
        />
      )}
    </div>
  );
}
