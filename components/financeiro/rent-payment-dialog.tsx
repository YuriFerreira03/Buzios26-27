"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/utils";
import { paraCentavos, paraReais } from "@/lib/split";
import type { RentStatus } from "@/types/aluguel";

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none transition focus:border-accent";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function RentPaymentDialog({
  userId,
  parcela,
  onClose,
  onDone,
}: {
  userId: string;
  parcela: RentStatus;
  onClose: () => void;
  onDone: () => void;
}) {
  const restante = paraCentavos(parcela.restante);

  const [valor, setValor] = useState(String(paraReais(restante).toFixed(2)));
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [metodo, setMetodo] = useState("Pix");
  const [salvando, setSalvando] = useState(false);

  const centavos = paraCentavos(valor);
  const valido = centavos > 0;
  const sobra = restante - centavos;

  async function salvar() {
    setSalvando(true);
    const supabase = createClient();

    const { error } = await supabase.from("rent_payments").insert({
      installment_id: parcela.id,
      amount: paraReais(centavos),
      paid_at: new Date(`${data}T12:00:00`).toISOString(),
      method: metodo.trim() || null,
      registered_by: userId,
    });

    setSalvando(false);

    if (error) {
      toast.error("Não deu para registrar", { description: error.message });
      return;
    }

    toast.success(
      sobra > 0 ? "Pagamento parcial registrado" : "Parcela quitada",
      { description: brl(paraReais(centavos)) },
    );
    onDone();
    onClose();
  }

  const mes = MESES[Number(parcela.reference_month.split("-")[1]) - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Pagar parcela de {mes}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="mb-4 rounded-xl bg-muted/60 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor da parcela</span>
            <span className="tabular-nums">{brl(parcela.amount)}</span>
          </div>
          {paraCentavos(parcela.pago) > 0 && (
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Já pago</span>
              <span className="tabular-nums">{brl(parcela.pago)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between font-medium">
            <span>Falta</span>
            <span className="tabular-nums">{brl(parcela.restante)}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="valor-pg" className="text-sm font-medium">
                Quanto está pagando
              </label>
              <input
                id="valor-pg"
                type="number"
                step="0.01"
                inputMode="decimal"
                className={campo}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="data-pg" className="text-sm font-medium">
                Data
              </label>
              <input
                id="data-pg"
                type="date"
                className={campo}
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="metodo" className="text-sm font-medium">
              Como pagou
            </label>
            <input
              id="metodo"
              className={campo}
              placeholder="Pix, dinheiro, transferência..."
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
            />
          </div>

          {centavos > 0 && sobra > 0 && (
            <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
              Ainda vão faltar {brl(paraReais(sobra))} nesta parcela.
            </p>
          )}
          {sobra < 0 && (
            <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm">
              Você está pagando {brl(paraReais(-sobra))} a mais do que falta nesta parcela.
            </p>
          )}

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
              Registrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
