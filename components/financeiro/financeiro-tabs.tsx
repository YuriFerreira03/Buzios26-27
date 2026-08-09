"use client";

import { useState } from "react";
import { Segmented } from "./segmented";
import { RentPanel } from "./rent-panel";
import { FundPanel } from "./fund-panel";
import type { Member } from "@/types/app";

type Aba = "aluguel" | "caixinha";

export function FinanceiroTabs({
  userId,
  membros,
  totalCasa,
}: {
  userId: string;
  membros: Member[];
  totalCasa: number;
}) {
  const [aba, setAba] = useState<Aba>("aluguel");

  return (
    <div className="space-y-6">
      <Segmented<Aba>
        layoutId="aba-financeiro"
        value={aba}
        onChange={setAba}
        options={[
          { value: "aluguel", label: "Aluguel" },
          { value: "caixinha", label: "Caixinha" },
        ]}
      />

      {aba === "aluguel" ? (
        <RentPanel userId={userId} membros={membros} totalCasa={totalCasa} />
      ) : (
        <FundPanel userId={userId} membros={membros} />
      )}
    </div>
  );
}
