"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ListChecks,
  MapPin,
  Vote,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { brl } from "@/lib/utils";
import { paraCentavos, paraReais } from "@/lib/split";

type Pendencia = {
  id: string;
  texto: string;
  detalhe: string;
  href: string;
  urgente: boolean;
};

type Dados = {
  saldo: number;
  parcelaValor: number;
  parcelaVence: string | null;
  parcelaAtrasada: boolean;
  restanteAluguel: number;
  levarMeus: number;
  levarMeusFeitos: number;
  levarTotal: number;
  levarTotalFeitos: number;
  enquetesAbertas: number;
  enquetesSemMeuVoto: string[];
  proximo: { title: string; day: string; starts_at: string | null; location: string | null } | null;
  itensHoje: number;
};

const VAZIO: Dados = {
  saldo: 0,
  parcelaValor: 0,
  parcelaVence: null,
  parcelaAtrasada: false,
  restanteAluguel: 0,
  levarMeus: 0,
  levarMeusFeitos: 0,
  levarTotal: 0,
  levarTotalFeitos: 0,
  enquetesAbertas: 0,
  enquetesSemMeuVoto: [],
  proximo: null,
  itensHoje: 0,
};

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

function diasAte(iso: string) {
  const alvo = new Date(`${iso}T12:00:00`).getTime();
  const hoje = new Date(`${hojeISO()}T12:00:00`).getTime();
  return Math.round((alvo - hoje) / 86_400_000);
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function HomePanel({ userId }: { userId: string }) {
  const [d, setD] = useState<Dados | null>(null);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const hoje = hojeISO();

    const [saldoRes, rentRes, levarRes, pollsRes, votosRes, schedRes] = await Promise.all([
      supabase.from("v_user_balances").select("saldo").eq("user_id", userId).maybeSingle(),
      supabase.from("v_rent_status").select("*").eq("user_id", userId).order("reference_month"),
      supabase.from("shopping_list").select("id, checked, assigned_to"),
      supabase.from("polls").select("id, question, closed_at, closes_at"),
      supabase.from("poll_votes").select("poll_id, user_id"),
      supabase
        .from("schedule")
        .select("title, day, starts_at, location")
        .gte("day", hoje)
        .order("day")
        .order("starts_at", { nullsFirst: false })
        .limit(20),
    ]);

    const parcelas = (rentRes.data as any[] | null) ?? [];
    const emAberto = parcelas.filter((p) => !p.paid);
    const prox = emAberto[0] ?? null;

    const levar = (levarRes.data as any[] | null) ?? [];
    const meus = levar.filter((i) => i.assigned_to === userId);

    const polls = (pollsRes.data as any[] | null) ?? [];
    const votos = (votosRes.data as any[] | null) ?? [];
    const abertas = polls.filter(
      (p) => !p.closed_at && (!p.closes_at || new Date(p.closes_at) > new Date()),
    );
    const meusVotos = new Set(votos.filter((v) => v.user_id === userId).map((v) => v.poll_id));

    const agenda = (schedRes.data as any[] | null) ?? [];

    setD({
      saldo: paraCentavos((saldoRes.data as { saldo: number } | null)?.saldo ?? 0),
      parcelaValor: prox ? paraCentavos(prox.restante) : 0,
      parcelaVence: prox?.due_date ?? null,
      parcelaAtrasada: prox ? prox.due_date < hoje : false,
      restanteAluguel: emAberto.reduce((s, p) => s + paraCentavos(p.restante), 0),
      levarMeus: meus.length,
      levarMeusFeitos: meus.filter((i) => i.checked).length,
      levarTotal: levar.length,
      levarTotalFeitos: levar.filter((i) => i.checked).length,
      enquetesAbertas: abertas.length,
      enquetesSemMeuVoto: abertas.filter((p) => !meusVotos.has(p.id)).map((p) => p.question),
      proximo: agenda[0] ?? null,
      itensHoje: agenda.filter((i) => i.day === hoje).length,
    });
  }, [userId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useRealtime(
    [
      "expenses",
      "expense_splits",
      "settlements",
      "rent_installments",
      "rent_payments",
      "shopping_list",
      "polls",
      "poll_votes",
      "schedule",
    ],
    carregar,
  );

  const pendencias = useMemo<Pendencia[]>(() => {
    if (!d) return [];
    const out: Pendencia[] = [];

    d.enquetesSemMeuVoto.slice(0, 2).forEach((q, i) => {
      out.push({
        id: `poll-${i}`,
        texto: "Falta seu voto",
        detalhe: q,
        href: "/enquetes",
        urgente: false,
      });
    });

    if (d.parcelaValor > 0 && d.parcelaVence) {
      const dias = diasAte(d.parcelaVence);
      out.push({
        id: "rent",
        texto: d.parcelaAtrasada
          ? "Parcela do aluguel vencida"
          : dias <= 7
            ? "Parcela do aluguel vencendo"
            : "Próxima parcela do aluguel",
        detalhe: `${brl(paraReais(d.parcelaValor))} · ${
          d.parcelaAtrasada
            ? `venceu há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}`
            : dias === 0
              ? "vence hoje"
              : `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`
        }`,
        href: "/financeiro",
        urgente: d.parcelaAtrasada || dias <= 3,
      });
    }

    if (d.saldo < 0) {
      out.push({
        id: "saldo",
        texto: "Você deve ao grupo",
        detalhe: `${brl(paraReais(-d.saldo))} das despesas compartilhadas`,
        href: "/financeiro",
        urgente: false,
      });
    }

    const levarFalta = d.levarMeus - d.levarMeusFeitos;
    if (levarFalta > 0) {
      out.push({
        id: "levar",
        texto: `${levarFalta} ${levarFalta === 1 ? "item seu" : "itens seus"} para separar`,
        detalhe: "Você ficou de levar e ainda não marcou",
        href: "/levar",
        urgente: false,
      });
    }

    return out;
  }, [d]);

  if (!d) return <Skeleton />;

  const atalhos = [
    {
      href: "/financeiro",
      icone: Wallet,
      titulo: "Grana",
      valor:
        d.saldo > 0
          ? brl(paraReais(d.saldo))
          : d.saldo < 0
            ? brl(paraReais(-d.saldo))
            : "Zerado",
      nota: d.saldo > 0 ? "te devem" : d.saldo < 0 ? "você deve" : "tudo certo",
      destaque: d.saldo < 0,
    },
    {
      href: "/levar",
      icone: ListChecks,
      titulo: "Levar",
      valor: `${d.levarTotalFeitos}/${d.levarTotal}`,
      nota: d.levarTotal === 0 ? "lista vazia" : "na mala",
      destaque: false,
    },
    {
      href: "/enquetes",
      icone: Vote,
      titulo: "Enquetes",
      valor: String(d.enquetesAbertas),
      nota: d.enquetesAbertas === 1 ? "aberta" : "abertas",
      destaque: d.enquetesSemMeuVoto.length > 0,
    },
    {
      href: "/programacao",
      icone: CalendarDays,
      titulo: "Roteiro",
      valor: d.itensHoje > 0 ? String(d.itensHoje) : d.proximo ? "1" : "0",
      nota: d.itensHoje > 0 ? "hoje" : d.proximo ? "a seguir" : "vazio",
      destaque: false,
    },
  ];

  return (
    <div className="space-y-5">
      {/* O que falta de você */}
      <section>
        <h2 className="mb-2 px-1 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Esperando por você
        </h2>

        {pendencias.length === 0 ? (
          <div className="card-soft flex items-center gap-3 p-5">
            <CheckCircle2 className="h-8 w-8 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="font-display font-semibold">Você está em dia</p>
              <p className="text-sm text-muted-foreground">
                Nada pendente. Aproveite a expectativa.
              </p>
            </div>
          </div>
        ) : (
          <ul className="card-soft divide-y divide-border/60 overflow-hidden">
            {pendencias.map((p, i) => (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
              >
                <Link href={p.href} className="flex items-center gap-3 p-4">
                  <span
                    aria-hidden
                    className={`h-9 w-1 shrink-0 rounded-full ${
                      p.urgente ? "bg-destructive" : "bg-accent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{p.texto}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{p.detalhe}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      {/* Atalhos com número vivo */}
      <section className="grid grid-cols-2 gap-3">
        {atalhos.map(({ href, icone: Icone, titulo, valor, nota, destaque }) => (
          <Link
            key={href}
            href={href}
            className={`card-soft p-4 transition active:scale-[0.98] ${
              destaque ? "ring-1 ring-accent/40" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <Icone className="h-4 w-4 text-secondary" aria-hidden />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {titulo}
              </span>
            </div>
            <p className="mt-2 font-display text-xl font-bold leading-none text-primary">
              {valor}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{nota}</p>
          </Link>
        ))}
      </section>

      {/* Próximo do roteiro */}
      {d.proximo && (
        <section>
          <h2 className="mb-2 px-1 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            A seguir
          </h2>

          <Link
            href="/programacao"
            className="card-soft flex items-center gap-3 p-5 transition active:scale-[0.99]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted">
              <MapPin className="h-5 w-5 text-secondary" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              <p className="font-display font-semibold leading-snug">{d.proximo.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {(() => {
                  const dias = diasAte(d.proximo!.day);
                  const quando =
                    dias === 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`;
                  const hora = d.proximo!.starts_at
                    ? ` · ${d.proximo!.starts_at.slice(0, 5)}`
                    : "";
                  const onde = d.proximo!.location ? ` · ${d.proximo!.location}` : "";
                  return `${quando}${hora}${onde}`;
                })()}
              </p>
            </div>

            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </section>
      )}
    </div>
  );
}
