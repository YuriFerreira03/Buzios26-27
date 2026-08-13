"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/utils";
import { paraCentavos, paraReais, distribuir } from "@/lib/split";
import { Segmented } from "./segmented";
import type { Member } from "@/types/app";
import type { RentStatus } from "@/types/aluguel";

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none transition focus:border-accent";

type Modo = "igual" | "individual";

export function RentParticipantsDialog({
  planId,
  membros,
  parcelas,
  onClose,
  onDone,
}: {
  planId: string;
  membros: Member[];
  parcelas: RentStatus[];
  onClose: () => void;
  onDone: () => void;
}) {
  const doPlano = parcelas.filter((p) => p.plan_id === planId);

  const mesesExistentes = Array.from(new Set(doPlano.map((p) => p.reference_month))).sort();
  const participantesAtuais = Array.from(new Set(doPlano.map((p) => p.user_id)));

  const [primeiro, setPrimeiro] = useState(
    mesesExistentes[0]?.slice(0, 7) ?? new Date().toISOString().slice(0, 7),
  );
  const [ultimo, setUltimo] = useState(
    mesesExistentes[mesesExistentes.length - 1]?.slice(0, 7) ?? "2026-12",
  );

  const [participantes, setParticipantes] = useState<string[]>(
    participantesAtuais.length > 0 ? participantesAtuais : membros.map((m) => m.id),
  );

  const [modo, setModo] = useState<Modo>("igual");
  const [totalCasa, setTotalCasa] = useState(() => {
    const soma = doPlano.reduce((s, p) => s + paraCentavos(p.amount), 0);
    return soma > 0 ? String(paraReais(soma).toFixed(2)) : "";
  });

  const [individuais, setIndividuais] = useState<Record<string, string>>(() => {
    const acc: Record<string, string> = {};
    participantesAtuais.forEach((uid) => {
      const total = doPlano
        .filter((p) => p.user_id === uid)
        .reduce((s, p) => s + paraCentavos(p.amount), 0);
      acc[uid] = paraReais(total).toFixed(2);
    });
    return acc;
  });

  const [salvando, setSalvando] = useState(false);

  /** Total de cada participante, em centavos. */
  const totais = useMemo(() => {
    const out: Record<string, number> = {};

    if (modo === "igual") {
      const partes = distribuir(paraCentavos(totalCasa), participantes.map(() => 1));
      participantes.forEach((id, i) => (out[id] = partes[i]));
    } else {
      participantes.forEach((id) => (out[id] = paraCentavos(individuais[id] ?? 0)));
    }

    return out;
  }, [modo, totalCasa, participantes, individuais]);

  const somaTotais = Object.values(totais).reduce((a, b) => a + b, 0);
  const valido = participantes.length > 0 && somaTotais > 0 && primeiro <= ultimo;

  /** Quantos meses o periodo cobre. */
  const meses = useMemo(() => {
    const [ay, am] = primeiro.split("-").map(Number);
    const [by, bm] = ultimo.split("-").map(Number);
    return (by - ay) * 12 + (bm - am) + 1;
  }, [primeiro, ultimo]);

  function alternar(id: string) {
    setParticipantes((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  async function salvar() {
    setSalvando(true);
    const supabase = createClient();

    const shares = participantes.map((id) => ({
      user_id: id,
      total: paraReais(totais[id] ?? 0),
    }));

    const { error } = await supabase.rpc("rent_set_participants", {
      p_plan_id: planId,
      p_first_month: `${primeiro}-01`,
      p_last_month: `${ultimo}-01`,
      p_shares: shares,
    });

    setSalvando(false);

    if (error) {
      toast.error("Não deu para salvar", { description: error.message });
      return;
    }

    toast.success("Participantes atualizados", {
      description: `${participantes.length} pessoas · ${meses} ${meses === 1 ? "mês" : "meses"}`,
    });
    onDone();
    onClose();
  }

  const nome = (m: Member) => (m.nickname || m.full_name).split(" ")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Participantes e valores</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="primeiro" className="text-sm font-medium">
                Primeiro mês
              </label>
              <input
                id="primeiro"
                type="month"
                className={campo}
                value={primeiro}
                onChange={(e) => setPrimeiro(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ultimo" className="text-sm font-medium">
                Último mês
              </label>
              <input
                id="ultimo"
                type="month"
                className={campo}
                value={ultimo}
                onChange={(e) => setUltimo(e.target.value)}
              />
            </div>
          </div>

          <Segmented<Modo>
            layoutId="modo-aluguel"
            value={modo}
            onChange={setModo}
            options={[
              { value: "igual", label: "Dividir igual" },
              { value: "individual", label: "Valor por pessoa" },
            ]}
          />

          {modo === "igual" && (
            <div className="space-y-1.5">
              <label htmlFor="total-casa" className="text-sm font-medium">
                Valor total da casa
              </label>
              <input
                id="total-casa"
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0,00"
                className={campo}
                value={totalCasa}
                onChange={(e) => setTotalCasa(e.target.value)}
              />
            </div>
          )}

          <ul className="divide-y divide-border/60 rounded-2xl border border-border/60">
            {membros.map((m) => {
              const dentro = participantes.includes(m.id);
              const total = totais[m.id] ?? 0;
              const porMes = meses > 0 ? Math.round(total / meses) : 0;

              return (
                <li key={m.id} className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    id={`rp-${m.id}`}
                    checked={dentro}
                    onChange={() => alternar(m.id)}
                    className="h-5 w-5 shrink-0 accent-[#0B4F6C]"
                  />
                  <label htmlFor={`rp-${m.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{nome(m)}</span>
                    {dentro && total > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {brl(paraReais(porMes))}/mês
                      </span>
                    )}
                  </label>

                  {dentro &&
                    (modo === "individual" ? (
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        aria-label={`Total de ${nome(m)}`}
                        placeholder="0,00"
                        className="h-9 w-28 rounded-lg border border-input bg-background px-2 text-right text-sm outline-none focus:border-accent"
                        value={individuais[m.id] ?? ""}
                        onChange={(e) =>
                          setIndividuais((atual) => ({ ...atual, [m.id]: e.target.value }))
                        }
                      />
                    ) : (
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {brl(paraReais(total))}
                      </span>
                    ))}
                </li>
              );
            })}
          </ul>

          <div className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
            {participantes.length} {participantes.length === 1 ? "pessoa" : "pessoas"} ·{" "}
            {meses} {meses === 1 ? "mês" : "meses"} · total {brl(paraReais(somaTotais))}
          </div>

          <p className="px-1 text-xs text-muted-foreground">
            Parcelas que já receberam pagamento não são apagadas nem reduzidas abaixo do
            que foi pago.
          </p>

          <div className="flex gap-2 pb-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-12 flex-1 rounded-xl border border-border text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={!valido || salvando}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
