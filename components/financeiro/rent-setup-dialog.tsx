"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/utils";

const schema = z.object({
  total: z.coerce.number().positive("Informe o valor total do aluguel."),
  primeiro: z.string().min(7, "Escolha o primeiro mês."),
  ultimo: z.string().min(7, "Escolha o último mês."),
  dia: z.coerce.number().int().min(1).max(28),
});

type FormData = z.infer<typeof schema>;

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none transition focus:border-accent";

export function RentSetupDialog({
  membros,
  totalAtual,
  onDone,
}: {
  membros: number;
  totalAtual: number;
  onDone: () => void;
}) {
  const [aberto, setAberto] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      total: totalAtual || undefined,
      primeiro: "2026-09",
      ultimo: "2026-12",
      dia: 10,
    },
  });

  const total = Number(watch("total")) || 0;
  const porPessoa = membros > 0 ? total / membros : 0;

  async function onSubmit(d: FormData) {
    const supabase = createClient();

    const { error: rpcError } = await supabase.rpc("generate_rent_installments", {
      p_total: d.total,
      p_first_month: `${d.primeiro}-01`,
      p_last_month: `${d.ultimo}-01`,
      p_due_day: d.dia,
    });

    if (rpcError) {
      toast.error("Não deu para gerar as parcelas", { description: rpcError.message });
      return;
    }

    await supabase.from("trip_settings").update({ house_total: d.total }).eq("id", true);

    toast.success("Parcelas geradas", {
      description: `${brl(porPessoa)} por pessoa, dividido entre ${membros}.`,
    });
    setAberto(false);
    onDone();
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium transition active:scale-[0.98]"
      >
        <Settings2 className="h-4 w-4" aria-hidden />
        Configurar aluguel
      </button>
    );
  }

  return (
    <div className="card-soft space-y-4 p-5">
      <div>
        <h3 className="font-display font-semibold">Configurar aluguel</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          O valor é dividido entre os {membros} membros aprovados e parcelado nos meses
          escolhidos. Parcelas já pagas não são afetadas.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="total" className="text-sm font-medium">
            Valor total da casa
          </label>
          <input id="total" type="number" step="0.01" className={campo} {...register("total")} />
          {errors.total && <p className="text-sm text-destructive">{errors.total.message}</p>}
          {total > 0 && (
            <p className="text-xs text-muted-foreground">
              {brl(porPessoa)} por pessoa
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="primeiro" className="text-sm font-medium">
              Primeiro mês
            </label>
            <input id="primeiro" type="month" className={campo} {...register("primeiro")} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ultimo" className="text-sm font-medium">
              Último mês
            </label>
            <input id="ultimo" type="month" className={campo} {...register("ultimo")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="dia" className="text-sm font-medium">
            Dia do vencimento
          </label>
          <input id="dia" type="number" min={1} max={28} className={campo} {...register("dia")} />
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
            Gerar parcelas
          </button>
        </div>
      </form>
    </div>
  );
}
