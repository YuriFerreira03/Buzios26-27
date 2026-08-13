"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { brl } from "@/lib/utils";
import { paraCentavos, paraReais } from "@/lib/split";
import type { RentStatus } from "@/types/aluguel";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesCurto = (iso: string) => MESES[Number(iso.split("-")[1]) - 1];
const diaMes = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

export function MyRentCard({ userId }: { userId: string }) {
  const [parcelas, setParcelas] = useState<RentStatus[] | null>(null);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("v_rent_status")
      .select("*")
      .eq("user_id", userId)
      .order("reference_month");
    setParcelas((data as RentStatus[] | null) ?? []);
  }, [userId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useRealtime(["rent_installments", "rent_payments"], carregar);

  if (parcelas === null) {
    return <div className="h-28 animate-pulse rounded-2xl bg-muted" />;
  }

  if (parcelas.length === 0) {
    return (
      <div className="card-soft p-5">
        <p className="text-sm text-muted-foreground">Sua parte do aluguel</p>
        <p className="mt-2 text-sm">
          Ainda não há aluguel configurado.{" "}
          <Link href="/financeiro" className="font-medium text-secondary underline underline-offset-4">
            Configurar
          </Link>
        </p>
      </div>
    );
  }

  const aberta = parcelas.find((p) => !p.paid);
  const restanteTotal = parcelas.reduce((s, p) => s + paraCentavos(p.restante), 0);
  const pagas = parcelas.filter((p) => p.paid).length;

  if (!aberta || restanteTotal <= 0) {
    return (
      <div className="card-soft flex items-center gap-3 p-5">
        <CheckCircle2 className="h-8 w-8 shrink-0 text-accent" aria-hidden />
        <div>
          <p className="font-display font-semibold">Aluguel em dia</p>
          <p className="text-sm text-muted-foreground">
            {pagas} de {parcelas.length} parcelas quitadas.
          </p>
        </div>
      </div>
    );
  }

  const parcial = paraCentavos(aberta.pago) > 0;

  return (
    <Link href="/financeiro" className="card-soft block p-5 transition active:scale-[0.99]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Próxima parcela do aluguel</p>
          <p className="mt-1 font-display text-2xl font-bold leading-none text-primary">
            {brl(aberta.restante)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="capitalize">{mesCurto(aberta.reference_month)}</span> · vence{" "}
            {diaMes(aberta.due_date)}
            {parcial && ` · já pagou ${brl(aberta.pago)}`}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">falta ao todo</p>
          <p className="font-display font-semibold tabular-nums">
            {brl(paraReais(restanteTotal))}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-1.5">
        {parcelas.map((p) => (
          <span
            key={p.id}
            title={mesCurto(p.reference_month)}
            className={`h-1.5 flex-1 overflow-hidden rounded-full bg-muted`}
          >
            <span
              className="block h-full rounded-full bg-accent"
              style={{
                width: `${
                  paraCentavos(p.amount) > 0
                    ? (paraCentavos(p.pago) / paraCentavos(p.amount)) * 100
                    : 0
                }%`,
              }}
            />
          </span>
        ))}
      </div>
    </Link>
  );
}
