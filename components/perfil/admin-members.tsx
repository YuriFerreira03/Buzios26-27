"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, ShieldCheck, UserMinus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";

type Membro = {
  id: string;
  full_name: string;
  email: string;
  approved: boolean;
  is_admin: boolean;
  created_at: string;
};

export function AdminMembers({ userId }: { userId: string }) {
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("users")
      .select("id, full_name, email, approved, is_admin, created_at")
      .order("created_at");
    setMembros((data as Membro[] | null) ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useRealtime(["users"], carregar);

  async function definir(m: Membro, aprovar: boolean) {
    setOcupado(m.id);
    const supabase = createClient();

    const { error } = await supabase.rpc("set_user_approval", {
      p_user_id: m.id,
      p_approved: aprovar,
    });

    setOcupado(null);

    if (error) {
      toast.error("Não deu para atualizar", { description: error.message });
      return;
    }

    toast.success(aprovar ? `${m.full_name} liberado` : `Acesso de ${m.full_name} removido`);
    carregar();
  }

  if (membros === null) {
    return <div className="h-32 animate-pulse rounded-2xl bg-muted" />;
  }

  const pendentes = membros.filter((m) => !m.approved);
  const aprovados = membros.filter((m) => m.approved);

  return (
    <section className="card-soft overflow-hidden">
      <header className="flex items-center gap-2 p-5 pb-4">
        <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
        <h2 className="font-display font-semibold">Aprovar membros</h2>
        {pendentes.length > 0 && (
          <span className="ml-auto rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
            {pendentes.length}
          </span>
        )}
      </header>

      {pendentes.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-muted-foreground">
          Ninguém esperando liberação.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 border-t border-border/60">
          {pendentes.map((m) => (
            <li key={m.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>

              <button
                onClick={() => definir(m, true)}
                disabled={ocupado === m.id}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {ocupado === m.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                )}
                Aprovar
              </button>
            </li>
          ))}
        </ul>
      )}

      {aprovados.length > 0 && (
        <>
          <p className="border-t border-border/60 bg-muted/30 px-5 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            No grupo ({aprovados.length})
          </p>

          <ul className="divide-y divide-border/60">
            {aprovados.map((m) => (
              <li key={m.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.full_name}
                    {m.is_admin && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        admin
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>

                {m.id !== userId && (
                  <button
                    onClick={() => definir(m, false)}
                    disabled={ocupado === m.id}
                    aria-label={`Remover acesso de ${m.full_name}`}
                    className="shrink-0 text-muted-foreground/40 transition hover:text-destructive disabled:opacity-60"
                  >
                    {ocupado === m.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <UserMinus className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
