"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Check, Clock, Lock, Trash2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Member } from "@/types/app";
import type { Poll, PollOption, PollVote } from "@/types/enquetes";

function prazoTexto(iso: string) {
  const d = new Date(iso);
  const dias = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (dias < 0) return "prazo vencido";
  if (dias === 0) return "encerra hoje";
  if (dias === 1) return "encerra amanhã";
  return `encerra em ${dias} dias`;
}

export function PollCard({
  poll,
  opcoes,
  votos,
  membros,
  userId,
  recarregar,
}: {
  poll: Poll;
  opcoes: PollOption[];
  votos: PollVote[];
  membros: Member[];
  userId: string;
  recarregar: () => void;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mostrarQuem, setMostrarQuem] = useState(false);

  const encerrada =
    !!poll.closed_at || (!!poll.closes_at && new Date(poll.closes_at) < new Date());

  const meus = votos.filter((v) => v.user_id === userId).map((v) => v.option_id);
  const votantes = new Set(votos.map((v) => v.user_id));
  const faltam = membros.filter((m) => !votantes.has(m.id));

  const totalPorOpcao = (id: string) => votos.filter((v) => v.option_id === id).length;
  const maior = Math.max(...opcoes.map((o) => totalPorOpcao(o.id)), 0);

  const nome = (id: string) => {
    const m = membros.find((x) => x.id === id);
    if (!m) return "—";
    return m.id === userId ? "Você" : (m.nickname || m.full_name).split(" ")[0];
  };

  async function votar(optionId: string) {
    if (encerrada) return;
    setOcupado(optionId);
    const supabase = createClient();

    const jaVotei = meus.includes(optionId);

    const { error } = jaVotei
      ? await supabase
          .from("poll_votes")
          .delete()
          .eq("option_id", optionId)
          .eq("user_id", userId)
      : await supabase
          .from("poll_votes")
          .insert({ poll_id: poll.id, option_id: optionId, user_id: userId });

    setOcupado(null);

    if (error) {
      toast.error("Não deu para votar", { description: error.message });
      return;
    }
    recarregar();
  }

  async function encerrar() {
    const supabase = createClient();
    const { error } = await supabase
      .from("polls")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", poll.id);

    if (error) {
      toast.error("Não deu para encerrar", { description: error.message });
      return;
    }
    toast.success("Enquete encerrada");
    recarregar();
  }

  async function apagar() {
    const supabase = createClient();
    const { error } = await supabase.from("polls").delete().eq("id", poll.id);

    if (error) {
      toast.error("Não deu para apagar", { description: error.message });
      return;
    }
    toast.success("Enquete removida");
    recarregar();
  }

  return (
    <article className={`card-soft overflow-hidden ${encerrada ? "opacity-90" : ""}`}>
      <header className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold leading-snug">{poll.question}</h2>
            {poll.details && (
              <p className="mt-1 text-sm text-muted-foreground">{poll.details}</p>
            )}
          </div>

          {encerrada && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden />
              Encerrada
            </span>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>por {nome(poll.created_by)}</span>
          {poll.multi && <span>· várias respostas</span>}
          {poll.closes_at && !poll.closed_at && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden />
              {prazoTexto(poll.closes_at)}
            </span>
          )}
        </div>
      </header>

      <ul className="space-y-2 px-5 pb-4">
        {opcoes.map((o) => {
          const n = totalPorOpcao(o.id);
          const pct = membros.length > 0 ? (n / membros.length) * 100 : 0;
          const escolhi = meus.includes(o.id);
          const lidera = n > 0 && n === maior;

          return (
            <li key={o.id}>
              <button
                onClick={() => votar(o.id)}
                disabled={encerrada || ocupado === o.id}
                aria-pressed={escolhi}
                className={`relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition ${
                  escolhi ? "border-accent bg-accent/5" : "border-border/70"
                } ${encerrada ? "cursor-default" : "active:scale-[0.99]"}`}
              >
                {/* barra de resultado ao vivo */}
                <motion.span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 ${lidera ? "bg-accent/20" : "bg-muted"}`}
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 220, damping: 30 }}
                />

                <span className="relative flex items-center gap-3">
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                      escolhi
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border text-transparent"
                    } ${poll.multi ? "rounded-md" : "rounded-full"}`}
                  >
                    <Check className="h-3 w-3" aria-hidden />
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.label}</span>

                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{n}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="border-t border-border/60 bg-muted/30 px-5 py-3">
        <button
          onClick={() => setMostrarQuem((v) => !v)}
          aria-expanded={mostrarQuem}
          className="flex w-full items-center gap-2 text-left text-xs"
        >
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-muted-foreground">
            {votantes.size} de {membros.length} votaram
            {faltam.length > 0 && !encerrada && (
              <span className="font-medium text-foreground">
                {" "}
                · falta {faltam.map((m) => nome(m.id)).join(", ")}
              </span>
            )}
          </span>
        </button>

        {mostrarQuem && (
          <ul className="mt-3 space-y-1.5">
            {opcoes.map((o) => {
              const quem = votos.filter((v) => v.option_id === o.id).map((v) => nome(v.user_id));
              if (quem.length === 0) return null;
              return (
                <li key={o.id} className="flex gap-2 text-xs">
                  <span className="shrink-0 font-medium">{o.label}:</span>
                  <span className="text-muted-foreground">{quem.join(", ")}</span>
                </li>
              );
            })}
          </ul>
        )}

        {poll.created_by === userId && (
          <div className="mt-3 flex gap-2">
            {!encerrada && (
              <button
                onClick={encerrar}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium"
              >
                <Lock className="h-3.5 w-3.5" aria-hidden />
                Encerrar
              </button>
            )}
            <button
              onClick={apagar}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Apagar
            </button>
          </div>
        )}
      </footer>
    </article>
  );
}
