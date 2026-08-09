"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Segmented } from "./segmented";
import { CATEGORIAS, type FundType, type Member } from "@/types/app";

const schema = z.object({
  amount: z.coerce.number().positive("Informe um valor maior que zero."),
  description: z.string().min(2, "Descreva o movimento."),
  category: z.string().min(1),
  member_id: z.string().uuid("Escolha a pessoa."),
  occurred_at: z.string().min(10, "Escolha a data."),
});

type FormData = z.infer<typeof schema>;

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none transition focus:border-accent";

export function TransactionDialog({
  userId,
  membros,
  onDone,
}: {
  userId: string;
  membros: Member[];
  onDone: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<FundType>("entrada");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "outros",
      member_id: userId,
      occurred_at: new Date().toISOString().slice(0, 10),
    },
  });

  async function onSubmit(d: FormData) {
    const supabase = createClient();

    const { error } = await supabase.from("common_fund_transactions").insert({
      type: tipo,
      amount: d.amount,
      description: d.description.trim(),
      category: d.category,
      member_id: d.member_id,
      created_by: userId,
      occurred_at: new Date(`${d.occurred_at}T12:00:00`).toISOString(),
    });

    if (error) {
      toast.error("Não deu para registrar", { description: error.message });
      return;
    }

    toast.success(tipo === "entrada" ? "Contribuição registrada" : "Gasto registrado");
    reset({
      category: "outros",
      member_id: userId,
      occurred_at: new Date().toISOString().slice(0, 10),
      description: "",
      amount: undefined,
    });
    setAberto(false);
    onDone();
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Registrar movimento
      </button>
    );
  }

  return (
    <div className="card-soft space-y-4 p-5">
      <h3 className="font-display font-semibold">Novo movimento</h3>

      <Segmented
        layoutId="tipo-transacao"
        value={tipo}
        onChange={setTipo}
        options={[
          { value: "entrada", label: "Entrada" },
          { value: "saida", label: "Saída" },
        ]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="amount" className="text-sm font-medium">
            Valor
          </label>
          <input
            id="amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            className={campo}
            {...register("amount")}
          />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            Descrição
          </label>
          <input
            id="description"
            placeholder={tipo === "entrada" ? "Pix da caixinha" : "Cerveja do mercado"}
            className={campo}
            {...register("description")}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="member_id" className="text-sm font-medium">
              {tipo === "entrada" ? "Quem contribuiu" : "Quem pagou"}
            </label>
            <select id="member_id" className={campo} {...register("member_id")}>
              {membros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nickname || m.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="category" className="text-sm font-medium">
              Categoria
            </label>
            <select id="category" className={campo} {...register("category")}>
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="occurred_at" className="text-sm font-medium">
            Data
          </label>
          <input id="occurred_at" type="date" className={campo} {...register("occurred_at")} />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="h-11 flex-1 rounded-xl border border-border text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
