"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIAS_ROTEIRO, type ScheduleCategory, type ScheduleItem } from "@/types/roteiro";

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none transition focus:border-accent";

export function ScheduleItemDialog({
  userId,
  dia,
  item,
  onClose,
  onDone,
}: {
  userId: string;
  dia: string;
  item: ScheduleItem | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const edicao = !!item;

  const [titulo, setTitulo] = useState(item?.title ?? "");
  const [data, setData] = useState(item?.day ?? dia);
  const [inicio, setInicio] = useState(item?.starts_at?.slice(0, 5) ?? "");
  const [fim, setFim] = useState(item?.ends_at?.slice(0, 5) ?? "");
  const [local, setLocal] = useState(item?.location ?? "");
  const [categoria, setCategoria] = useState<ScheduleCategory>(item?.category ?? "outros");
  const [descricao, setDescricao] = useState(item?.description ?? "");
  const [salvando, setSalvando] = useState(false);

  const valido = titulo.trim().length >= 2 && !!data && (!fim || !inicio || fim >= inicio);

  async function salvar() {
    setSalvando(true);
    const supabase = createClient();

    const dados = {
      day: data,
      starts_at: inicio || null,
      ends_at: fim || null,
      title: titulo.trim(),
      description: descricao.trim() || null,
      location: local.trim() || null,
      category: categoria,
    };

    const { error } = edicao
      ? await supabase
          .from("schedule")
          .update({ ...dados, updated_by: userId })
          .eq("id", item!.id)
      : await supabase.from("schedule").insert({ ...dados, created_by: userId });

    setSalvando(false);

    if (error) {
      toast.error("Não deu para salvar", { description: error.message });
      return;
    }

    toast.success(edicao ? "Atualizado" : "Adicionado ao roteiro");
    onDone();
    onClose();
  }

  async function apagar() {
    const supabase = createClient();
    const { error } = await supabase.from("schedule").delete().eq("id", item!.id);

    if (error) {
      toast.error("Não deu para apagar", { description: error.message });
      return;
    }
    toast.success("Removido do roteiro");
    onDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            {edicao ? "Editar" : "Adicionar ao roteiro"}
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="titulo-r" className="text-sm font-medium">
              O que é
            </label>
            <input
              id="titulo-r"
              className={campo}
              placeholder="Escuna pelas ilhas"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="data-r" className="text-sm font-medium">
                Dia
              </label>
              <input
                id="data-r"
                type="date"
                className={campo}
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="inicio-r" className="text-sm font-medium">
                Início
              </label>
              <input
                id="inicio-r"
                type="time"
                className={campo}
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="fim-r" className="text-sm font-medium">
                Fim
              </label>
              <input
                id="fim-r"
                type="time"
                className={campo}
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </div>
          </div>

          <p className="-mt-2 px-1 text-xs text-muted-foreground">
            Sem horário? Deixe em branco — vai para &ldquo;a qualquer hora&rdquo; no fim do dia.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="local-r" className="text-sm font-medium">
                Onde
              </label>
              <input
                id="local-r"
                className={campo}
                placeholder="Praia de Geribá"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cat-r" className="text-sm font-medium">
                Tipo
              </label>
              <select
                id="cat-r"
                className={campo}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as ScheduleCategory)}
              >
                {CATEGORIAS_ROTEIRO.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="desc-r" className="text-sm font-medium">
              Detalhes <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="desc-r"
              className={campo}
              placeholder="R$ 80 por pessoa, leva toalha"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pb-2 pt-1">
            {edicao ? (
              <button
                type="button"
                onClick={apagar}
                aria-label="Apagar"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-border text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="h-12 flex-1 rounded-xl border border-border text-sm font-medium"
              >
                Cancelar
              </button>
            )}

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
