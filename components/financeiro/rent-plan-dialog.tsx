"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Member } from "@/types/app";
import type { RentPlan } from "@/types/aluguel";

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none transition focus:border-accent";

export function RentPlanDialog({
  userId,
  membros,
  plano,
  onClose,
  onDone,
}: {
  userId: string;
  membros: Member[];
  /** Plano em edicao, ou null para criar. */
  plano: RentPlan | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [titulo, setTitulo] = useState(plano?.title ?? "Casa em Búzios");
  const [recebedor, setRecebedor] = useState(plano?.payee_id ?? userId);
  const [dia, setDia] = useState(String(plano?.due_day ?? 5));
  const [pix, setPix] = useState(plano?.pix_key ?? "");
  const [obs, setObs] = useState(plano?.notes ?? "");
  const [salvando, setSalvando] = useState(false);

  const diaNum = Number(dia);
  const valido = titulo.trim().length >= 2 && diaNum >= 1 && diaNum <= 28;

  async function salvar() {
    setSalvando(true);
    const supabase = createClient();

    const dados = {
      title: titulo.trim(),
      payee_id: recebedor,
      due_day: diaNum,
      pix_key: pix.trim() || null,
      notes: obs.trim() || null,
    };

    const { error } = plano
      ? await supabase.from("rent_plans").update(dados).eq("id", plano.id)
      : await supabase.from("rent_plans").insert({ ...dados, created_by: userId });

    setSalvando(false);

    if (error) {
      toast.error("Não deu para salvar", { description: error.message });
      return;
    }

    toast.success(plano ? "Plano atualizado" : "Plano criado");
    onDone();
    onClose();
  }

  const nome = (m: Member) =>
    m.id === userId ? "Você" : (m.nickname || m.full_name).split(" ")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            {plano ? "Editar aluguel" : "Novo aluguel"}
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="titulo" className="text-sm font-medium">
              Nome
            </label>
            <input
              id="titulo"
              className={campo}
              placeholder="Casa da Ferradura"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="recebedor" className="text-sm font-medium">
              Quem recebe
            </label>
            <select
              id="recebedor"
              className={campo}
              value={recebedor}
              onChange={(e) => setRecebedor(e.target.value)}
            >
              {membros.map((m) => (
                <option key={m.id} value={m.id}>
                  {nome(m)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              É para essa pessoa que todo mundo paga. Ela repassa ao proprietário.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="dia" className="text-sm font-medium">
                Vence todo dia
              </label>
              <input
                id="dia"
                type="number"
                min={1}
                max={28}
                className={campo}
                value={dia}
                onChange={(e) => setDia(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pix" className="text-sm font-medium">
                Chave Pix
              </label>
              <input
                id="pix"
                className={campo}
                placeholder="opcional"
                value={pix}
                onChange={(e) => setPix(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="obs" className="text-sm font-medium">
              Observação
            </label>
            <input
              id="obs"
              className={campo}
              placeholder="opcional"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
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
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
