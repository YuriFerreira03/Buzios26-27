"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Fase = "antes" | "viagem" | "virada" | "fim";

type Parts = { dias: number; horas: number; min: number; seg: number };

function parts(alvo: Date): Parts {
  const ms = Math.max(0, alvo.getTime() - Date.now());
  return {
    dias: Math.floor(ms / 86_400_000),
    horas: Math.floor((ms / 3_600_000) % 24),
    min: Math.floor((ms / 60_000) % 60),
    seg: Math.floor((ms / 1000) % 60),
  };
}

const UNITS: { key: keyof Parts; label: string }[] = [
  { key: "dias", label: "dias" },
  { key: "horas", label: "horas" },
  { key: "min", label: "min" },
  { key: "seg", label: "seg" },
];

/** Onda que se repete a cada 180 unidades: permite loop sem emenda. */
const WAVE =
  "M0,22 C30,6 60,38 90,22 C120,6 150,38 180,22 C210,6 240,38 270,22 C300,6 330,38 360,22 " +
  "C390,6 420,38 450,22 C480,6 510,38 540,22 C570,6 600,38 630,22 C660,6 690,38 720,22 L720,64 L0,64 Z";

function Ondas({ parado }: { parado: boolean }) {
  const camadas = [
    { fill: "#0A3C55", opacity: 0.6, duracao: 26, altura: "h-16" },
    { fill: "#D4AF37", opacity: 0.16, duracao: 19, altura: "h-12" },
  ];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 overflow-hidden">
      {camadas.map((c, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 720 64"
          preserveAspectRatio="none"
          aria-hidden
          className={`absolute bottom-0 w-[200%] ${c.altura}`}
          style={{ opacity: c.opacity }}
          animate={parado ? undefined : { x: ["0%", "-50%"] }}
          transition={{ duration: c.duracao, repeat: Infinity, ease: "linear" }}
        >
          <path d={WAVE} fill={c.fill} />
        </motion.svg>
      ))}
    </div>
  );
}

/** Céu noturno: pontos fixos, sem piscar, para não competir com os números. */
const ESTRELAS = [
  { x: 12, y: 18, o: 0.5 },
  { x: 26, y: 9, o: 0.3 },
  { x: 38, y: 24, o: 0.4 },
  { x: 54, y: 12, o: 0.25 },
  { x: 68, y: 20, o: 0.45 },
  { x: 81, y: 8, o: 0.35 },
  { x: 90, y: 26, o: 0.3 },
  { x: 47, y: 32, o: 0.2 },
  { x: 7, y: 34, o: 0.25 },
];

const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function formataDia(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return `${String(d.getDate()).padStart(2, "0")} ${MESES_CURTOS[d.getMonth()]}`;
}

export function CountdownHero({
  checkIn,
  checkOut,
  virada,
  casa,
}: {
  checkIn: string | null;
  checkOut: string | null;
  virada: string;
  casa: string | null;
}) {
  const reduzir = useReducedMotion();
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { fase, alvo, rotulo } = useMemo(() => {
    const dViagem = checkIn ? new Date(`${checkIn}T14:00:00-03:00`) : null;
    const dVirada = new Date(virada);
    const dFim = checkOut ? new Date(`${checkOut}T11:00:00-03:00`) : null;
    const t = new Date(agora);

    if (dViagem && t < dViagem) {
      return { fase: "antes" as Fase, alvo: dViagem, rotulo: "até a viagem" };
    }
    if (t < dVirada) {
      return { fase: "viagem" as Fase, alvo: dVirada, rotulo: "até a virada" };
    }
    if (dFim && t < dFim) {
      return {
        fase: "virada" as Fase,
        alvo: dFim,
        rotulo: "de Búzios pela frente",
      };
    }
    return { fase: "fim" as Fase, alvo: dVirada, rotulo: "" };
  }, [checkIn, checkOut, virada, agora]);

  const t = parts(alvo);
  const anoNovo = new Date(virada).getFullYear() + 1;

  return (
    <section className="relative isolate overflow-hidden rounded-3xl shadow-soft">
      {/* céu */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#03202F_0%,#0B4F6C_56%,#1B6B93_100%)]" />

      {/* estrelas */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-1/2">
        {ESTRELAS.map((s, i) => (
          <span
            key={i}
            className="absolute h-[2px] w-[2px] rounded-full bg-sand-50"
            style={{ left: `${s.x}%`, top: `${s.y}%`, opacity: s.o }}
          />
        ))}
      </div>

      {/* brilho do sol */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-2 mx-auto h-64 w-64 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgba(255,215,0,0.42) 0%, rgba(255,215,0,0.10) 46%, rgba(255,215,0,0) 72%)",
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-9 left-1/2 h-14 w-14 -translate-x-1/2 rounded-full bg-gold-neon/90 blur-[2px]"
      />

      <Ondas parado={!!reduzir} />

      <div className="relative z-10 px-6 pb-12 pt-7 text-center">
        {/* período da viagem */}
        {checkIn && checkOut && (
          <p className="font-display text-[11px] font-medium uppercase tracking-[0.34em] text-gold-neon/90">
            {formataDia(checkIn)} — {formataDia(checkOut)}
          </p>
        )}

        {fase === "fim" ? (
          <div className="mt-7">
            <p className="font-display text-4xl font-bold text-sand-50">
              Foi bom demais
            </p>
            <p className="mt-3 text-sm text-sand-100/75">
              {anoNovo} começou em Búzios.
            </p>
          </div>
        ) : (
          <>
            {fase === "virada" && (
              <p className="mt-5 font-display text-3xl font-bold text-gold-neon">
                Feliz {anoNovo}
              </p>
            )}

            <div
              className={`flex items-start justify-center gap-1 ${fase === "virada" ? "mt-4" : "mt-6"}`}
            >
              {UNITS.map(({ key, label }, i) => (
                <div key={key} className="flex items-start">
                  <div className="flex w-[62px] flex-col items-center">
                    <motion.span
                      key={t[key]}
                      initial={reduzir ? false : { y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                      className="bg-gradient-to-b from-[#FFF0B8] to-[#D4AF37] bg-clip-text font-display text-[40px] font-bold leading-none tabular-nums text-transparent"
                    >
                      {String(t[key]).padStart(2, "0")}
                    </motion.span>
                    <span className="mt-2 text-[10px] uppercase tracking-[0.18em] text-sand-100/65">
                      {label}
                    </span>
                  </div>
                  {i < UNITS.length - 1 && (
                    <span
                      aria-hidden
                      className="mt-1 font-display text-[30px] font-light leading-none text-sand-100/20"
                    >
                      :
                    </span>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-sand-100/70">
              {rotulo}
            </p>
          </>
        )}

        {casa && (
          <p className="mt-4 text-sm font-medium text-sand-100/85">{casa}</p>
        )}
      </div>
    </section>
  );
}
