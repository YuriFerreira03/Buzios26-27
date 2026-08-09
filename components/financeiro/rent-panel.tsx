"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { brl } from "@/lib/utils";
import { RentSetupDialog } from "./rent-setup-dialog";
import type { Member, RentInstallment } from "@/types/app";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const mesCurto = (iso: string) => MESES[Number(iso.split("-")[1]) - 1];
const diaMes = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      <div className="h-52 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export function RentPanel({
  userId,
  membros,
  totalCasa,
}: {
  userId: string;
  membros: Member[];
  totalCasa: number;
}) {
  const [parcelas, setParcelas] = useState<RentInstallment[] | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("rent_installments")
      .select("*")
      .order("reference_month");
    setParcelas((data as RentInstallment[] | null) ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useRealtime(["rent_installments"], carregar);

  async function alternar(p: RentInstallment) {
    setSalvando(p.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("rent_installments")
      .update({ paid: !p.paid })
      .eq("id", p.id);
    setSalvando(null);

    if (error) {
      toast.error("Não deu para atualizar", { description: error.message });
      return;
    }
    toast.success(p.paid ? "Baixa desfeita" : "Parcela quitada");
    carregar();
  }

  if (parcelas === null) return <Skeleton />;

  if (parcelas.length === 0) {
    return (
      <div className="card-soft space-y-4 p-6 text-center">
        <h3 className="font-display text-lg font-semibold">Nenhuma parcela ainda</h3>
        <p className="text-sm text-muted-foreground">
          Informe o valor da casa e o período. O sistema divide entre os{" "}
          {membros.length} membros e cria as parcelas de cada um.
        </p>
        <div className="flex justify-center">
          <RentSetupDialog membros={membros.length} totalAtual={totalCasa} onDone={carregar} />
        </div>
      </div>
    );
  }

  const meses = Array.from(new Set(parcelas.map((p) => p.reference_month))).sort();
  const minhas = parcelas.filter((p) => p.user_id === userId);

  const total = parcelas.reduce((s, p) => s + Number(p.amount), 0);
  const pago = parcelas.filter((p) => p.paid).reduce((s, p) => s + Number(p.amount), 0);
  const pct = total > 0 ? Math.round((pago / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Panorama */}
      <section className="card-soft p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Arrecadado do aluguel</p>
            <p className="mt-1 font-display text-[28px] font-bold leading-none text-primary">
              {brl(pago)}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">de {brl(total)}</p>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{pct}% do total quitado</p>
      </section>

      {/* Minhas parcelas */}
      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Suas parcelas
        </h2>

        <ul className="card-soft divide-y divide-border/60 overflow-hidden">
          {minhas.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-4">
              <button
                onClick={() => alternar(p)}
                disabled={salvando === p.id}
                aria-label={p.paid ? "Desfazer baixa" : "Dar baixa"}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition ${
                  p.paid
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border text-transparent hover:border-accent"
                }`}
              >
                {salvando === p.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-foreground" aria-hidden />
                ) : (
                  <Check className="h-4 w-4" aria-hidden />
                )}
              </button>

              <div className="flex-1">
                <p className="font-medium capitalize">{mesCurto(p.reference_month)}</p>
                <p className="text-xs text-muted-foreground">
                  {p.paid ? "Pago" : `Vence ${diaMes(p.due_date)}`}
                </p>
              </div>

              <p
                className={`font-display font-semibold tabular-nums ${
                  p.paid ? "text-muted-foreground line-through" : "text-primary"
                }`}
              >
                {brl(p.amount)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Grade do grupo */}
      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          O grupo
        </h2>

        <div className="card-soft overflow-x-auto p-4">
          <table className="w-full min-w-max border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr>
                <th className="pr-4 text-left font-normal text-muted-foreground">Quem</th>
                {meses.map((m) => (
                  <th
                    key={m}
                    className="px-2 text-center text-[11px] font-normal uppercase text-muted-foreground"
                  >
                    {mesCurto(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {membros.map((m) => {
                const suas = parcelas.filter((p) => p.user_id === m.id);
                const emDia = suas.length > 0 && suas.every((p) => p.paid);

                return (
                  <tr key={m.id}>
                    <td className="pr-4">
                      <span className={emDia ? "font-medium text-primary" : ""}>
                        {(m.nickname || m.full_name).split(" ")[0]}
                      </span>
                    </td>
                    {meses.map((mes) => {
                      const p = suas.find((x) => x.reference_month === mes);
                      return (
                        <td key={mes} className="px-2 text-center">
                          <span
                            title={p ? (p.paid ? "Pago" : "Em aberto") : "Sem parcela"}
                            className={`inline-block h-2.5 w-2.5 rounded-full ${
                              !p ? "bg-border" : p.paid ? "bg-accent" : "bg-muted-foreground/25"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-4 px-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" /> pago
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" /> em aberto
          </span>
        </div>
      </section>

      <div className="flex justify-center pt-1">
        <RentSetupDialog membros={membros.length} totalAtual={totalCasa} onDone={carregar} />
      </div>
    </div>
  );
}
