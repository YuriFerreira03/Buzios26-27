"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Vote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { Segmented } from "@/components/financeiro/segmented";
import { PollCard } from "./poll-card";
import { PollDialog } from "./poll-dialog";
import type { Member } from "@/types/app";
import type { Poll, PollOption, PollVote } from "@/types/enquetes";

type Aba = "abertas" | "decididas";

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 animate-pulse rounded-2xl bg-muted" />
      <div className="h-56 animate-pulse rounded-2xl bg-muted" />
      <div className="h-56 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export function PollsList({ userId, membros }: { userId: string; membros: Member[] }) {
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [opcoes, setOpcoes] = useState<PollOption[]>([]);
  const [votos, setVotos] = useState<PollVote[]>([]);
  const [aba, setAba] = useState<Aba>("abertas");
  const [dialogo, setDialogo] = useState(false);

  const carregar = useCallback(async () => {
    const supabase = createClient();

    const [p, o, v] = await Promise.all([
      supabase.from("polls").select("*").order("created_at", { ascending: false }),
      supabase.from("poll_options").select("*").order("position"),
      supabase.from("poll_votes").select("*"),
    ]);

    setPolls((p.data as Poll[] | null) ?? []);
    setOpcoes((o.data as PollOption[] | null) ?? []);
    setVotos((v.data as PollVote[] | null) ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useRealtime(["polls", "poll_options", "poll_votes"], carregar);

  if (polls === null) return <Skeleton />;

  const estaEncerrada = (p: Poll) =>
    !!p.closed_at || (!!p.closes_at && new Date(p.closes_at) < new Date());

  const abertas = polls.filter((p) => !estaEncerrada(p));
  const decididas = polls.filter(estaEncerrada);
  const lista = aba === "abertas" ? abertas : decididas;

  return (
    <div className="space-y-5">
      <button
        onClick={() => setDialogo(true)}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Nova enquete
      </button>

      {polls.length > 0 && (
        <Segmented<Aba>
          layoutId="aba-enquetes"
          value={aba}
          onChange={setAba}
          options={[
            { value: "abertas", label: `Abertas${abertas.length ? ` (${abertas.length})` : ""}` },
            { value: "decididas", label: `Decididas${decididas.length ? ` (${decididas.length})` : ""}` },
          ]}
        />
      )}

      {polls.length === 0 ? (
        <div className="card-soft space-y-2 p-8 text-center">
          <Vote className="mx-auto h-10 w-10 text-muted-foreground/40" aria-hidden />
          <p className="font-display font-semibold">Nenhuma enquete ainda</p>
          <p className="text-sm text-muted-foreground">
            Em vez de 200 mensagens no grupo, faça a pergunta aqui e fica registrado o que
            foi decidido.
          </p>
        </div>
      ) : lista.length === 0 ? (
        <div className="card-soft p-8 text-center text-sm text-muted-foreground">
          {aba === "abertas"
            ? "Nada pendente de decisão."
            : "Nenhuma decisão registrada ainda."}
        </div>
      ) : (
        <div className="space-y-4">
          {lista.map((p) => (
            <PollCard
              key={p.id}
              poll={p}
              opcoes={opcoes.filter((o) => o.poll_id === p.id)}
              votos={votos.filter((v) => v.poll_id === p.id)}
              membros={membros}
              userId={userId}
              recarregar={carregar}
            />
          ))}
        </div>
      )}

      {dialogo && <PollDialog onClose={() => setDialogo(false)} onDone={carregar} />}
    </div>
  );
}
