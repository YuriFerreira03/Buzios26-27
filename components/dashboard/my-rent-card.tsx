"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { brl } from "@/lib/utils";
import type { RentInstallment } from "@/types/app";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function mesExtenso(iso: string) {
  const [ano, mes] = iso.split("-");
  return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`;
}

function diaMes(iso: string) {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

export function MyRentCard({
  userId,
  inicial,
}: {
  userId: string;
  inicial: RentInstallment[];
}) {
  const [parcelas, setParcelas] = useState(inicial);
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("rent_installments")
      .select("*")
      .eq("user_id", userId)
      .order("reference_month");
    if (data) setParcelas(data as RentInstallment[]);
  }, [userId]);

  useRealtime(["rent_installments"], carregar);

  async function darBaixa(id: string) {
    setSalvando(id);
    const supabase = createClient();
    const { error } = await supabase.from("rent_installments").update({ paid: true }).eq("id", id);
    setSalvando(null);

    if (error) {
      toast.error("Não deu para dar baixa", { description: error.message });
      return;
    }
    toast.success("Parcela quitada");
    carregar();
  }

  if (parcelas.length === 0) {
    return (
      <div className="card-soft p-5">
        <p className="text-sm text-muted-foreground">Sua parte do aluguel</p>
        <p className="mt-2 text-sm">
          As parcelas ainda não foram criadas.{" "}
          <Link href="/financeiro" className="font-medium text-secondary underline underline-offset-4">
            Configurar agora
          </Link>
        </p>
      </div>
    );
  }

  const aberta = parcelas.find((p) => !p.paid);
  const pagas = parcelas.filter((p) => p.paid).length;

  if (!aberta) {
    return (
      <div className="card-soft flex items-center gap-3 p-5">
        <CheckCircle2 className="h-8 w-8 shrink-0 text-accent" aria-hidden />
        <div>
          <p className="font-display font-semibold">Você está em dia</p>
          <p className="text-sm text-muted-foreground">
            {pagas} de {parcelas.length} parcelas quitadas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-soft p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Sua próxima parcela</p>
          <p className="mt-1 font-display text-2xl font-bold leading-none text-primary">
            {brl(aberta.amount)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {mesExtenso(aberta.reference_month)} · vence {diaMes(aberta.due_date)}
          </p>
        </div>

        <button
          onClick={() => darBaixa(aberta.id)}
          disabled={salvando === aberta.id}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-secondary disabled:opacity-60"
        >
          {salvando === aberta.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Dar baixa
        </button>
      </div>

      <div className="mt-4 flex gap-1.5" aria-label={`${pagas} de ${parcelas.length} parcelas pagas`}>
        {parcelas.map((p) => (
          <span
            key={p.id}
            title={mesExtenso(p.reference_month)}
            className={`h-1.5 flex-1 rounded-full ${p.paid ? "bg-accent" : "bg-muted"}`}
          />
        ))}
      </div>
    </div>
  );
}
