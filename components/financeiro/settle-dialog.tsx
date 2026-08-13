"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/utils";
import { paraCentavos, paraReais } from "@/lib/split";
import type { Member } from "@/types/app";

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none transition focus:border-accent";

export function SettleDialog({
  userId,
  membros,
  sugestao,
  onClose,
  onDone,
}: {
  userId: string;
  membros: Member[];
  /** Par e valor sugeridos ao abrir a partir de uma linha de saldo. */
  sugestao: { from: string; to: string; amount: number } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [de, setDe] = useState(sugestao?.from ?? userId);
  const [para, setPara] = useState(
    sugestao?.to ?? membros.find((m) => m.id !== userId)?.id ?? "",
  );
  const [valor, setValor] = useState(
    sugestao ? String(paraReais(sugestao.amount).toFixed(2)) : "",
  );
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);

  const centavos = paraCentavos(valor);
  const valido = de !== para && centavos > 0;

  async function salvar() {
    setSalvando(true);
    const supabase = createClient();

    const { error } = await supabase.from("settlements").insert({
      from_user: de,
      to_user: para,
      amount: paraReais(centavos),
      occurred_at: data,
      note: nota.trim() || null,
      created_by: userId,
    });

    setSalvando(false);

    if (error) {
      toast.error("Não deu para registrar o acerto", { description: error.message });
      return;
    }

    toast.success("Acerto registrado", { description: brl(paraReais(centavos)) });
    onDone();
    onClose();
  }

  const nome = (id: string) => {
    const m = membros.find((x) => x.id === id);
    if (!m) return "—";
    return m.id === userId ? "Você" : (m.nickname || m.full_name).split(" ")[0];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Registrar acerto</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="de" className="text-sm font-medium">
                Quem pagou
              </label>
              <select id="de" className={campo} value={de} onChange={(e) => setDe(e.target.value)}>
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {nome(m.id)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="para" className="text-sm font-medium">
                Quem recebeu
              </label>
              <select
                id="para"
                className={campo}
                value={para}
                onChange={(e) => setPara(e.target.value)}
              >
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {nome(m.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {de === para && (
            <p className="text-sm text-destructive">Escolha duas pessoas diferentes.</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="valor-acerto" className="text-sm font-medium">
                Valor
              </label>
              <input
                id="valor-acerto"
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0,00"
                className={campo}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="data-acerto" className="text-sm font-medium">
                Data
              </label>
              <input
                id="data-acerto"
                type="date"
                className={campo}
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="nota" className="text-sm font-medium">
              Observação <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="nota"
              className={campo}
              placeholder="Pix, dinheiro..."
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </div>

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
