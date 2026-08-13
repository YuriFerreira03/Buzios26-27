"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { brl } from "@/lib/utils";

export type SaldoUsuario = { saldo: number; total_pago: number; total_devido: number };

export function BalanceCard({
  userId,
  inicial,
}: {
  userId: string;
  inicial: SaldoUsuario | null;
}) {
  const [s, setS] = useState<SaldoUsuario | null>(inicial);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("v_user_balances")
      .select("saldo, total_pago, total_devido")
      .eq("user_id", userId)
      .maybeSingle();
    setS((data as SaldoUsuario | null) ?? null);
  }, [userId]);

  useRealtime(["expenses", "expense_splits", "settlements"], carregar);

  const saldo = Number(s?.saldo ?? 0);

  return (
    <Link href="/financeiro" className="card-soft block p-5 transition active:scale-[0.99]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {saldo > 0 ? "O grupo te deve" : saldo < 0 ? "Você deve ao grupo" : "Contas do grupo"}
          </p>
          <p
            className={`mt-1 font-display text-[32px] font-bold leading-none ${
              saldo > 0 ? "text-secondary" : saldo < 0 ? "text-destructive" : "text-primary"
            }`}
          >
            {saldo === 0 ? "Tudo certo" : brl(Math.abs(saldo))}
          </p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 text-muted-foreground" aria-hidden />
      </div>

      {s && (Number(s.total_pago) > 0 || Number(s.total_devido) > 0) && (
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span>Você pagou {brl(s.total_pago)}</span>
          <span>Sua parte {brl(s.total_devido)}</span>
        </div>
      )}
    </Link>
  );
}
