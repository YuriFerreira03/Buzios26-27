"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Users, Wallet, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { brl } from "@/lib/utils";
import { paraCentavos, paraReais } from "@/lib/split";
import { RentPlanDialog } from "./rent-plan-dialog";
import { RentParticipantsDialog } from "./rent-participants-dialog";
import { RentPaymentDialog } from "./rent-payment-dialog";
import type { Member } from "@/types/app";
import type { RentPlan, RentStatus } from "@/types/aluguel";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesCurto = (iso: string) => MESES[Number(iso.split("-")[1]) - 1];
const diaMes = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      <div className="h-44 animate-pulse rounded-2xl bg-muted" />
      <div className="h-56 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export function RentPanel({ userId, membros }: { userId: string; membros: Member[] }) {
  const [plano, setPlano] = useState<RentPlan | null | undefined>(undefined);
  const [parcelas, setParcelas] = useState<RentStatus[]>([]);
  const [copiado, setCopiado] = useState(false);

  const [dlgPlano, setDlgPlano] = useState(false);
  const [dlgParticipantes, setDlgParticipantes] = useState(false);
  const [dlgPagamento, setDlgPagamento] = useState<RentStatus | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const supabase = createClient();

    const { data: planos } = await supabase
      .from("rent_plans")
      .select("*")
      .eq("active", true)
      .order("created_at")
      .limit(1);

    const p = ((planos as RentPlan[] | null) ?? [])[0] ?? null;
    setPlano(p);

    if (!p) {
      setParcelas([]);
      return;
    }

    const { data } = await supabase
      .from("v_rent_status")
      .select("*")
      .eq("plan_id", p.id)
      .order("reference_month");

    setParcelas((data as RentStatus[] | null) ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useRealtime(["rent_plans", "rent_installments", "rent_payments"], carregar);

  if (plano === undefined) return <Skeleton />;

  const nome = (id: string) => {
    const m = membros.find((x) => x.id === id);
    if (!m) return "—";
    return m.id === userId ? "Você" : (m.nickname || m.full_name).split(" ")[0];
  };

  // Sem plano: convite para criar.
  if (!plano) {
    return (
      <>
        <div className="card-soft space-y-4 p-8 text-center">
          <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40" aria-hidden />
          <div>
            <h3 className="font-display text-lg font-semibold">Nenhum aluguel configurado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Dê um nome à casa, escolha quem recebe o dinheiro e defina quanto cada um paga.
            </p>
          </div>
          <button
            onClick={() => setDlgPlano(true)}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Configurar aluguel
          </button>
        </div>

        {dlgPlano && (
          <RentPlanDialog
            userId={userId}
            membros={membros}
            plano={null}
            onClose={() => setDlgPlano(false)}
            onDone={carregar}
          />
        )}
      </>
    );
  }

  const total = parcelas.reduce((s, p) => s + paraCentavos(p.amount), 0);
  const pago = parcelas.reduce((s, p) => s + paraCentavos(p.pago), 0);
  const pct = total > 0 ? Math.round((pago / total) * 100) : 0;

  const minhas = parcelas.filter((p) => p.user_id === userId);
  const meuRestante = minhas.reduce((s, p) => s + paraCentavos(p.restante), 0);

  const pessoas = Array.from(new Set(parcelas.map((p) => p.user_id)));
  const souRecebedor = plano.payee_id === userId;

  async function copiarPix() {
    if (!plano?.pix_key) return;
    await navigator.clipboard.writeText(plano.pix_key);
    setCopiado(true);
    toast.success("Chave Pix copiada");
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Cabecalho do plano */}
      <section className="card-soft overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-5 pb-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">{plano.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Pagar para <span className="font-medium text-foreground">{nome(plano.payee_id)}</span>{" "}
              · vence dia {plano.due_day}
            </p>
            {plano.notes && (
              <p className="mt-1 text-xs text-muted-foreground">{plano.notes}</p>
            )}
          </div>

          <button
            onClick={() => setDlgPlano(true)}
            aria-label="Editar aluguel"
            className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {plano.pix_key && (
          <button
            onClick={copiarPix}
            className="flex w-full items-center gap-2 border-t border-border/60 px-5 py-3 text-left text-sm"
          >
            {copiado ? (
              <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            ) : (
              <Copy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{plano.pix_key}</span>
            <span className="shrink-0 text-xs font-medium text-secondary">copiar</span>
          </button>
        )}

        <div className="border-t border-border/60 bg-muted/30 px-5 py-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Arrecadado</p>
              <p className="mt-0.5 font-display text-2xl font-bold leading-none text-primary">
                {brl(paraReais(pago))}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">de {brl(paraReais(total))}</p>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Suas parcelas */}
      {minhas.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Suas parcelas
            </h2>
            <span className="text-sm">
              {meuRestante > 0 ? (
                <>
                  falta <span className="font-semibold">{brl(paraReais(meuRestante))}</span>
                </>
              ) : (
                <span className="font-semibold text-accent">tudo pago</span>
              )}
            </span>
          </div>

          <ul className="card-soft divide-y divide-border/60 overflow-hidden">
            {minhas.map((p) => {
              const restante = paraCentavos(p.restante);
              const pagoC = paraCentavos(p.pago);
              const parcial = pagoC > 0 && restante > 0;

              return (
                <li key={p.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium capitalize">{mesCurto(p.reference_month)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.paid
                        ? "Quitada"
                        : parcial
                          ? `Pago ${brl(p.pago)} de ${brl(p.amount)}`
                          : `Vence ${diaMes(p.due_date)}`}
                    </p>
                    {parcial && (
                      <div className="mt-2 h-1 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${(pagoC / paraCentavos(p.amount)) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`font-display font-semibold tabular-nums ${
                        p.paid ? "text-muted-foreground line-through" : "text-primary"
                      }`}
                    >
                      {brl(p.paid ? p.amount : p.restante)}
                    </p>
                  </div>

                  {!p.paid && (
                    <button
                      onClick={() => setDlgPagamento(p)}
                      className="h-9 shrink-0 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
                    >
                      Pagar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Situacao do grupo */}
      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quem já acertou
        </h2>

        <ul className="card-soft divide-y divide-border/60 overflow-hidden">
          {pessoas.map((uid) => {
            const suas = parcelas.filter((p) => p.user_id === uid);
            const t = suas.reduce((s, p) => s + paraCentavos(p.amount), 0);
            const pg = suas.reduce((s, p) => s + paraCentavos(p.pago), 0);
            const falta = t - pg;
            const aberto = expandido === uid;

            return (
              <li key={uid}>
                <button
                  onClick={() => setExpandido(aberto ? null : uid)}
                  aria-expanded={aberto}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{nome(uid)}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-500"
                        style={{ width: `${t > 0 ? (pg / t) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {falta > 0 ? (
                      <>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          falta
                        </p>
                        <p className="font-display font-semibold tabular-nums">
                          {brl(paraReais(falta))}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-accent">em dia</p>
                    )}
                  </div>
                </button>

                {aberto && (
                  <ul className="space-y-1.5 border-t border-border/60 bg-muted/30 px-4 py-3">
                    {suas.map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-muted-foreground">
                          {mesCurto(p.reference_month)}
                        </span>
                        <span className="tabular-nums">
                          {brl(p.pago)} / {brl(p.amount)}
                        </span>
                        {souRecebedor && !p.paid && (
                          <button
                            onClick={() => setDlgPagamento(p)}
                            className="ml-3 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium"
                          >
                            Dar baixa
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        {souRecebedor && (
          <p className="px-1 text-xs text-muted-foreground">
            Como você recebe o aluguel, pode registrar o pagamento de qualquer pessoa.
          </p>
        )}
      </section>

      <div className="flex gap-2">
        <button
          onClick={() => setDlgParticipantes(true)}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-medium"
        >
          <Users className="h-4 w-4" aria-hidden />
          Participantes e valores
        </button>
      </div>

      {dlgPlano && (
        <RentPlanDialog
          userId={userId}
          membros={membros}
          plano={plano}
          onClose={() => setDlgPlano(false)}
          onDone={carregar}
        />
      )}

      {dlgParticipantes && (
        <RentParticipantsDialog
          planId={plano.id}
          membros={membros}
          parcelas={parcelas}
          onClose={() => setDlgParticipantes(false)}
          onDone={carregar}
        />
      )}

      {dlgPagamento && (
        <RentPaymentDialog
          userId={userId}
          parcela={dlgPagamento}
          onClose={() => setDlgPagamento(null)}
          onDone={carregar}
        />
      )}
    </div>
  );
}
