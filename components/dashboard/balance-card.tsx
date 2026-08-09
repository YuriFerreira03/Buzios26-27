"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { brl } from "@/lib/utils";
import type { Balance } from "@/types/app";

export function BalanceCard({ inicial }: { inicial: Balance }) {
  const [b, setB] = useState<Balance>(inicial);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("v_common_fund_balance").select("*").single();
    if (data) setB(data as Balance);
  }, []);

  useRealtime(["common_fund_transactions"], carregar);

  const entrada = Number(b.total_in) || 0;
  const saida = Number(b.total_out) || 0;
  const movimentado = entrada + saida;
  const pctEntrada = movimentado > 0 ? (entrada / movimentado) * 100 : 0;

  return (
    <Link href="/financeiro" className="card-soft block p-5 transition active:scale-[0.99]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Saldo da caixinha</p>
          <p className="mt-1 font-display text-[32px] font-bold leading-none text-primary">
            {brl(b.balance)}
          </p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 text-muted-foreground" aria-hidden />
      </div>

      {movimentado > 0 && (
        <>
          <div className="mt-5 flex h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="bg-secondary" style={{ width: `${pctEntrada}%` }} />
            <div className="flex-1 bg-accent/70" />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <ArrowUpRight className="h-3.5 w-3.5 text-secondary" aria-hidden />
              Entrou {brl(entrada)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <ArrowDownRight className="h-3.5 w-3.5 text-accent" aria-hidden />
              Saiu {brl(saida)}
            </span>
          </div>
        </>
      )}
    </Link>
  );
}
