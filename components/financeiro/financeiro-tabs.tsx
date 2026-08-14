"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { Segmented } from "./segmented";
import { ExpensesPanel } from "./expenses-panel";
import { BalancesPanel } from "./balances-panel";
import { RentPanel } from "./rent-panel";
import type { Member } from "@/types/app";
import type { Expense, ExpenseSplit, Settlement } from "@/types/grana";

type Aba = "despesas" | "saldos" | "aluguel";

export function FinanceiroTabs({
  userId,
  isAdmin,
  membros,
  totalCasa,
}: {
  userId: string;
  isAdmin: boolean;
  membros: Member[];
  totalCasa: number;
}) {
  const [aba, setAba] = useState<Aba>("despesas");

  // Despesas, divisoes e acertos vivem aqui: as abas Despesas e Saldos
  // leem exatamente os mesmos dados, entao carregar uma vez so evita
  // que as duas telas discordem entre si.
  const [despesas, setDespesas] = useState<Expense[] | null>(null);
  const [divisoes, setDivisoes] = useState<ExpenseSplit[]>([]);
  const [acertos, setAcertos] = useState<Settlement[]>([]);

  const carregar = useCallback(async () => {
    const supabase = createClient();

    const [e, d, a] = await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .order("occurred_at", { ascending: false }),
      supabase.from("expense_splits").select("*"),
      supabase
        .from("settlements")
        .select("*")
        .order("occurred_at", { ascending: false }),
    ]);

    setDespesas((e.data as Expense[] | null) ?? []);
    setDivisoes((d.data as ExpenseSplit[] | null) ?? []);
    setAcertos((a.data as Settlement[] | null) ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useRealtime(["expenses", "expense_splits", "settlements"], carregar);

  return (
    <div className="space-y-6">
      <Segmented<Aba>
        layoutId="aba-financeiro"
        value={aba}
        onChange={setAba}
        options={[
          { value: "despesas", label: "Despesas" },
          { value: "saldos", label: "Saldos" },
          { value: "aluguel", label: "Aluguel" },
        ]}
      />

      {aba === "despesas" && (
        <ExpensesPanel
          userId={userId}
          isAdmin={isAdmin}
          membros={membros}
          despesas={despesas}
          divisoes={divisoes}
          recarregar={carregar}
        />
      )}

      {aba === "saldos" && (
        <BalancesPanel
          userId={userId}
          membros={membros}
          despesas={despesas}
          divisoes={divisoes}
          acertos={acertos}
          recarregar={carregar}
        />
      )}

      {aba === "aluguel" && <RentPanel userId={userId} membros={membros} />}
    </div>
  );
}
