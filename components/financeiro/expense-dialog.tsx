"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/utils";
import { distribuir, paraCentavos, paraReais } from "@/lib/split";
import { Segmented } from "./segmented";
import { CATEGORIAS, type Member } from "@/types/app";
import type { Expense, ExpenseSplit, SplitMethod } from "@/types/grana";

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none transition focus:border-accent";

type Metodo = Extract<SplitMethod, "igual" | "exato" | "porcentagem">;

export function ExpenseDialog({
  userId,
  membros,
  aberta,
  divisoes,
  onClose,
  onDone,
}: {
  userId: string;
  membros: Member[];
  /** Despesa em edicao, ou null para criar uma nova. */
  aberta: Expense | null;
  divisoes: ExpenseSplit[];
  onClose: () => void;
  onDone: () => void;
}) {
  const edicao = !!aberta;
  const divisoesDaDespesa = aberta ? divisoes.filter((d) => d.expense_id === aberta.id) : [];

  const [descricao, setDescricao] = useState(aberta?.description ?? "");
  const [valor, setValor] = useState(aberta ? String(aberta.amount) : "");
  const [pagador, setPagador] = useState(aberta?.paid_by ?? userId);
  const [categoria, setCategoria] = useState<string>(aberta?.category ?? "outros");
  const [data, setData] = useState(aberta?.occurred_at ?? new Date().toISOString().slice(0, 10));
  const [metodo, setMetodo] = useState<Metodo>(
    aberta && aberta.split_method !== "cotas" ? (aberta.split_method as Metodo) : "igual",
  );

  const [participantes, setParticipantes] = useState<string[]>(
    edicao ? divisoesDaDespesa.map((d) => d.user_id) : membros.map((m) => m.id),
  );

  const [manuais, setManuais] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    divisoesDaDespesa.forEach((d) => (inicial[d.user_id] = String(d.share)));
    return inicial;
  });

  const [salvando, setSalvando] = useState(false);

  const totalCentavos = paraCentavos(valor);

  /** Divisao resultante, em centavos, por participante. */
  const calculo = useMemo(() => {
    if (participantes.length === 0) return { partes: {} as Record<string, number>, soma: 0 };

    let partes: Record<string, number> = {};

    if (metodo === "igual") {
      const valores = distribuir(totalCentavos, participantes.map(() => 1));
      participantes.forEach((id, i) => (partes[id] = valores[i]));
    } else if (metodo === "exato") {
      participantes.forEach((id) => (partes[id] = paraCentavos(manuais[id] ?? 0)));
    } else {
      const pesos = participantes.map((id) => Number(manuais[id] ?? 0));
      const valores = distribuir(totalCentavos, pesos);
      participantes.forEach((id, i) => (partes[id] = valores[i]));
    }

    const soma = Object.values(partes).reduce((a, b) => a + b, 0);
    return { partes, soma };
  }, [participantes, metodo, manuais, totalCentavos]);

  const somaPercentual = participantes.reduce((s, id) => s + Number(manuais[id] ?? 0), 0);

  const diferenca =
    metodo === "porcentagem" ? 0 : totalCentavos - calculo.soma;

  const percentualInvalido =
    metodo === "porcentagem" && Math.abs(somaPercentual - 100) > 0.01;

  const podeSalvar =
    descricao.trim().length >= 2 &&
    totalCentavos > 0 &&
    participantes.length > 0 &&
    diferenca === 0 &&
    !percentualInvalido;

  function alternarParticipante(id: string) {
    setParticipantes((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  async function salvar() {
    setSalvando(true);
    const supabase = createClient();

    const splits = participantes.map((id) => ({
      user_id: id,
      share: paraReais(calculo.partes[id] ?? 0),
    }));

    const { error } = await supabase.rpc("save_expense", {
      p_description: descricao.trim(),
      p_amount: paraReais(totalCentavos),
      p_category: categoria,
      p_paid_by: pagador,
      p_split_method: metodo,
      p_occurred_at: data,
      p_splits: splits,
      p_notes: null,
      p_expense_id: aberta?.id ?? null,
    });

    setSalvando(false);

    if (error) {
      toast.error("Não deu para salvar", { description: error.message });
      return;
    }

    toast.success(edicao ? "Despesa atualizada" : "Despesa lançada");
    onDone();
    onClose();
  }

  const nome = (m: Member) => (m.nickname || m.full_name).split(" ")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            {edicao ? "Editar despesa" : "Nova despesa"}
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="descricao" className="text-sm font-medium">
              O que foi
            </label>
            <input
              id="descricao"
              className={campo}
              placeholder="Mercado, gasolina, casa noturna..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="valor" className="text-sm font-medium">
                Valor total
              </label>
              <input
                id="valor"
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
              <label htmlFor="data" className="text-sm font-medium">
                Data
              </label>
              <input
                id="data"
                type="date"
                className={campo}
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="pagador" className="text-sm font-medium">
                Quem pagou
              </label>
              <select
                id="pagador"
                className={campo}
                value={pagador}
                onChange={(e) => setPagador(e.target.value)}
              >
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === userId ? "Você" : nome(m)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="categoria" className="text-sm font-medium">
                Categoria
              </label>
              <select
                id="categoria"
                className={campo}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-sm font-medium">Como dividir</p>
            <Segmented<Metodo>
              layoutId="metodo-divisao"
              value={metodo}
              onChange={setMetodo}
              options={[
                { value: "igual", label: "Igual" },
                { value: "exato", label: "Valor" },
                { value: "porcentagem", label: "%" },
              ]}
            />
          </div>

          <ul className="divide-y divide-border/60 rounded-2xl border border-border/60">
            {membros.map((m) => {
              const dentro = participantes.includes(m.id);
              return (
                <li key={m.id} className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    id={`p-${m.id}`}
                    checked={dentro}
                    onChange={() => alternarParticipante(m.id)}
                    className="h-5 w-5 shrink-0 accent-[#0B4F6C]"
                  />
                  <label htmlFor={`p-${m.id}`} className="flex-1 text-sm">
                    {m.id === userId ? "Você" : nome(m)}
                  </label>

                  {dentro && metodo !== "igual" && (
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      aria-label={`Parte de ${nome(m)}`}
                      placeholder={metodo === "porcentagem" ? "%" : "0,00"}
                      className="h-9 w-24 rounded-lg border border-input bg-background px-2 text-right text-sm outline-none focus:border-accent"
                      value={manuais[m.id] ?? ""}
                      onChange={(e) =>
                        setManuais((atual) => ({ ...atual, [m.id]: e.target.value }))
                      }
                    />
                  )}

                  {dentro && metodo === "igual" && (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {brl(paraReais(calculo.partes[m.id] ?? 0))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Conferencia */}
          {totalCentavos > 0 && participantes.length > 0 && (
            <div
              className={`rounded-xl px-4 py-3 text-sm ${
                podeSalvar
                  ? "bg-muted/60 text-muted-foreground"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {metodo === "porcentagem" ? (
                percentualInvalido ? (
                  <>Os percentuais somam {somaPercentual.toFixed(2)}%. Precisa dar 100%.</>
                ) : (
                  <>
                    {brl(paraReais(totalCentavos))} dividido entre {participantes.length}{" "}
                    {participantes.length === 1 ? "pessoa" : "pessoas"}.
                  </>
                )
              ) : diferenca === 0 ? (
                <>
                  {brl(paraReais(totalCentavos))} dividido entre {participantes.length}{" "}
                  {participantes.length === 1 ? "pessoa" : "pessoas"}.
                </>
              ) : diferenca > 0 ? (
                <>Faltam {brl(paraReais(diferenca))} para fechar o valor.</>
              ) : (
                <>Passou {brl(paraReais(-diferenca))} do valor da despesa.</>
              )}
            </div>
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
              disabled={!podeSalvar || salvando}
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

export function BotaoNovaDespesa({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition active:scale-[0.99]"
    >
      <Plus className="h-4 w-4" aria-hidden />
      Adicionar despesa
    </button>
  );
}
