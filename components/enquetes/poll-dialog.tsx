"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GripVertical, Loader2, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none transition focus:border-accent";

export function PollDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [pergunta, setPergunta] = useState("");
  const [detalhes, setDetalhes] = useState("");
  const [opcoes, setOpcoes] = useState<string[]>(["", ""]);
  const [multi, setMulti] = useState(false);
  const [prazo, setPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const validas = opcoes.map((o) => o.trim()).filter((o) => o.length > 0);
  const valido = pergunta.trim().length >= 3 && validas.length >= 2;

  function mudar(i: number, valor: string) {
    setOpcoes((atual) => atual.map((o, k) => (k === i ? valor : o)));
  }

  function adicionar() {
    setOpcoes((atual) => [...atual, ""]);
  }

  function remover(i: number) {
    setOpcoes((atual) => (atual.length <= 2 ? atual : atual.filter((_, k) => k !== i)));
  }

  async function salvar() {
    setSalvando(true);
    const supabase = createClient();

    const { error } = await supabase.rpc("create_poll", {
      p_question: pergunta.trim(),
      p_options: validas,
      p_details: detalhes.trim() || null,
      p_multi: multi,
      p_closes_at: prazo ? new Date(`${prazo}T23:59:00`).toISOString() : null,
    });

    setSalvando(false);

    if (error) {
      toast.error("Não deu para criar", { description: error.message });
      return;
    }

    toast.success("Enquete criada");
    onDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Nova enquete</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="pergunta" className="text-sm font-medium">
              O que o grupo precisa decidir
            </label>
            <input
              id="pergunta"
              className={campo}
              placeholder="Saímos dia 29 ou 30?"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="detalhes" className="text-sm font-medium">
              Contexto <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="detalhes"
              className={campo}
              placeholder="Dia 29 pega menos trânsito, mas é uma diária a mais"
              value={detalhes}
              onChange={(e) => setDetalhes(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Opções</p>
            <ul className="space-y-2">
              {opcoes.map((o, i) => (
                <li key={i} className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden />
                  <input
                    className={campo}
                    placeholder={`Opção ${i + 1}`}
                    aria-label={`Opção ${i + 1}`}
                    value={o}
                    onChange={(e) => mudar(i, e.target.value)}
                  />
                  <button
                    onClick={() => remover(i)}
                    disabled={opcoes.length <= 2}
                    aria-label={`Remover opção ${i + 1}`}
                    className="shrink-0 text-muted-foreground/50 transition hover:text-destructive disabled:opacity-30"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            <button
              onClick={adicionar}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Mais uma opção
            </button>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
            <input
              type="checkbox"
              checked={multi}
              onChange={(e) => setMulti(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-[#0B4F6C]"
            />
            <span className="text-sm">
              Pode marcar mais de uma
              <span className="block text-xs text-muted-foreground">
                Útil para &ldquo;quais praias você topa?&rdquo;
              </span>
            </span>
          </label>

          <div className="space-y-1.5">
            <label htmlFor="prazo" className="text-sm font-medium">
              Prazo <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="prazo"
              type="date"
              className={campo}
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
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
              Criar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
