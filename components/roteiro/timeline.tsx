"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Car,
  MapPin,
  PartyPopper,
  Plus,
  Ship,
  Umbrella,
  UtensilsCrossed,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { ScheduleItemDialog } from "./schedule-item-dialog";
import type { Member } from "@/types/app";
import type { Attendance, ScheduleCategory, ScheduleItem } from "@/types/roteiro";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const ICONES: Record<ScheduleCategory, typeof MapPin> = {
  praia: Umbrella,
  refeicao: UtensilsCrossed,
  festa: PartyPopper,
  passeio: Ship,
  logistica: Car,
  outros: MapPin,
};

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

/** Lista de dias entre duas datas, inclusive. */
function intervalo(inicio: string, fim: string) {
  const out: string[] = [];
  const d = new Date(`${inicio}T12:00:00`);
  const f = new Date(`${fim}T12:00:00`);
  while (d <= f) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`,
    );
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-16 animate-pulse rounded-2xl bg-muted" />
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export function Timeline({
  userId,
  membros,
  checkIn,
  checkOut,
}: {
  userId: string;
  membros: Member[];
  checkIn: string | null;
  checkOut: string | null;
}) {
  const [itens, setItens] = useState<ScheduleItem[] | null>(null);
  const [presencas, setPresencas] = useState<Attendance[]>([]);
  const [dia, setDia] = useState<string>("");
  const [dialogo, setDialogo] = useState<{ aberto: boolean; item: ScheduleItem | null }>({
    aberto: false,
    item: null,
  });

  const trilhaRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    const supabase = createClient();

    const [s, a] = await Promise.all([
      supabase.from("schedule").select("*").order("day").order("starts_at", { nullsFirst: false }),
      supabase.from("schedule_attendance").select("*"),
    ]);

    setItens((s.data as ScheduleItem[] | null) ?? []);
    setPresencas((a.data as Attendance[] | null) ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useRealtime(["schedule", "schedule_attendance"], carregar);

  /** Dias da viagem + qualquer dia que já tenha item. */
  const dias = useMemo(() => {
    const base = checkIn && checkOut ? intervalo(checkIn, checkOut) : [];
    const comItens = (itens ?? []).map((i) => i.day);
    return Array.from(new Set([...base, ...comItens])).sort();
  }, [checkIn, checkOut, itens]);

  // Abre no dia de hoje se ele fizer parte da viagem; senão, no primeiro.
  useEffect(() => {
    if (dia || dias.length === 0) return;
    const h = hojeISO();
    setDia(dias.includes(h) ? h : dias[0]);
  }, [dias, dia]);

  // Centraliza o dia escolhido na régua.
  useEffect(() => {
    const el = trilhaRef.current?.querySelector<HTMLElement>('[data-ativo="true"]');
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [dia]);

  if (itens === null) return <Skeleton />;

  const nome = (id: string) => {
    const m = membros.find((x) => x.id === id);
    if (!m) return "?";
    return (m.nickname || m.full_name).split(" ")[0];
  };

  const doDia = itens
    .filter((i) => i.day === dia)
    .sort((a, b) => {
      if (!a.starts_at && !b.starts_at) return a.position - b.position;
      if (!a.starts_at) return 1;
      if (!b.starts_at) return -1;
      return a.starts_at.localeCompare(b.starts_at);
    });

  const ehHoje = dia === hojeISO();
  const agora = new Date().toTimeString().slice(0, 5);

  async function alternarPresenca(itemId: string, vou: boolean) {
    const supabase = createClient();

    const { error } = vou
      ? await supabase
          .from("schedule_attendance")
          .delete()
          .eq("schedule_id", itemId)
          .eq("user_id", userId)
      : await supabase
          .from("schedule_attendance")
          .insert({ schedule_id: itemId, user_id: userId });

    if (error) {
      toast.error("Não deu para atualizar", { description: error.message });
      return;
    }
    carregar();
  }

  return (
    <div className="space-y-5">
      {/* Regua de dias */}
      {dias.length > 0 && (
        <div ref={trilhaRef} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {dias.map((d) => {
            const data = new Date(`${d}T12:00:00`);
            const ativo = d === dia;
            const virada = d.slice(5) === "12-31";
            const hoje = d === hojeISO();
            const qtd = itens.filter((i) => i.day === d).length;

            return (
              <button
                key={d}
                data-ativo={ativo}
                onClick={() => setDia(d)}
                aria-pressed={ativo}
                className={`relative flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition ${
                  ativo
                    ? "border-primary bg-primary text-primary-foreground"
                    : virada
                      ? "border-accent/50 bg-accent/10"
                      : "border-border/70 bg-card"
                }`}
              >
                <span className="text-[10px] uppercase tracking-wide opacity-70">
                  {DIAS_SEMANA[data.getDay()]}
                </span>
                <span className="font-display text-xl font-bold leading-tight">
                  {String(data.getDate()).padStart(2, "0")}
                </span>
                <span className="text-[9px] uppercase tracking-wide opacity-60">
                  {virada ? "virada" : hoje ? "hoje" : qtd > 0 ? `${qtd} item${qtd > 1 ? "s" : ""}` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setDialogo({ aberto: true, item: null })}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Adicionar ao roteiro
      </button>

      {doDia.length === 0 ? (
        <div className="card-soft space-y-2 p-8 text-center">
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground/40" aria-hidden />
          <p className="font-display font-semibold">Dia livre</p>
          <p className="text-sm text-muted-foreground">
            Nada marcado. Coloque a primeira coisa e o resto do grupo vai vendo.
          </p>
        </div>
      ) : (
        <ol className="relative space-y-3 pl-[62px]">
          {/* trilho vertical */}
          <span
            aria-hidden
            className="absolute bottom-2 left-[46px] top-2 w-px bg-border"
          />

          {doDia.map((item, idx) => {
            const Icone = ICONES[item.category] ?? MapPin;
            const vao = presencas.filter((p) => p.schedule_id === item.id);
            const euVou = vao.some((p) => p.user_id === userId);

            const anterior = doDia[idx - 1];
            const marcarAgora =
              ehHoje &&
              !!item.starts_at &&
              item.starts_at.slice(0, 5) > agora &&
              (!anterior?.starts_at || anterior.starts_at.slice(0, 5) <= agora);

            return (
              <li key={item.id} className="relative">
                {marcarAgora && (
                  <div className="mb-3 flex items-center gap-2" aria-label="Momento atual">
                    <span className="-ml-[62px] w-[38px] text-right text-[10px] font-semibold uppercase tracking-wide text-accent">
                      agora
                    </span>
                    <span className="h-px flex-1 bg-accent/60" />
                  </div>
                )}

                {/* horario + marcador */}
                <span className="absolute -left-[62px] top-3 w-[38px] text-right text-xs font-medium tabular-nums text-muted-foreground">
                  {item.starts_at ? item.starts_at.slice(0, 5) : "—"}
                </span>
                <span
                  aria-hidden
                  className={`absolute -left-[20px] top-4 grid h-3 w-3 place-items-center rounded-full ring-4 ring-background ${
                    item.category === "festa" ? "bg-accent" : "bg-secondary"
                  }`}
                />

                <div className="card-soft overflow-hidden">
                  <button
                    onClick={() => setDialogo({ aberto: true, item })}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted">
                        <Icone className="h-4 w-4 text-secondary" aria-hidden />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="font-display font-semibold leading-snug">{item.title}</p>

                        {(item.location || item.ends_at) && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.location}
                            {item.location && item.ends_at ? " · " : ""}
                            {item.ends_at ? `até ${item.ends_at.slice(0, 5)}` : ""}
                          </p>
                        )}

                        {item.description && (
                          <p className="mt-1.5 text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-3 border-t border-border/60 bg-muted/30 px-4 py-2.5">
                    <button
                      onClick={() => alternarPresenca(item.id, euVou)}
                      aria-pressed={euVou}
                      className={`h-8 shrink-0 rounded-lg px-3 text-xs font-semibold transition ${
                        euVou
                          ? "bg-accent text-accent-foreground"
                          : "border border-border bg-card text-foreground"
                      }`}
                    >
                      {euVou ? "Eu vou" : "Topo"}
                    </button>

                    <div className="min-w-0 flex-1">
                      {vao.length === 0 ? (
                        <p className="text-xs text-muted-foreground">ninguém confirmou ainda</p>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-2">
                            {vao.slice(0, 5).map((p) => (
                              <motion.span
                                key={p.id}
                                initial={{ scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                title={nome(p.user_id)}
                                className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground ring-2 ring-card"
                              >
                                {nome(p.user_id).charAt(0).toUpperCase()}
                              </motion.span>
                            ))}
                          </div>
                          <span className="truncate text-xs text-muted-foreground">
                            {vao.length === membros.length
                              ? "todo mundo"
                              : `${vao.length} confirmado${vao.length > 1 ? "s" : ""}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {dialogo.aberto && (
        <ScheduleItemDialog
          userId={userId}
          dia={dia}
          item={dialogo.item}
          onClose={() => setDialogo({ aberto: false, item: null })}
          onDone={carregar}
        />
      )}
    </div>
  );
}
