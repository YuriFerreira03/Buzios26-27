"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Parts = { dias: number; horas: number; min: number; seg: number };

function parts(target: Date): Parts {
  const ms = Math.max(0, target.getTime() - Date.now());
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

/** Onda que se repete a cada 180 unidades — permite loop sem emenda. */
const WAVE =
  "M0,22 C30,6 60,38 90,22 C120,6 150,38 180,22 C210,6 240,38 270,22 C300,6 330,38 360,22 " +
  "C390,6 420,38 450,22 C480,6 510,38 540,22 C570,6 600,38 630,22 C660,6 690,38 720,22 L720,64 L0,64 Z";

function Waves({ still }: { still: boolean }) {
  const camadas = [
    { fill: "#0A3C55", opacity: 0.55, duracao: 26, altura: "h-16" },
    { fill: "#D4AF37", opacity: 0.14, duracao: 19, altura: "h-12" },
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
          animate={still ? undefined : { x: ["0%", "-50%"] }}
          transition={{ duration: c.duracao, repeat: Infinity, ease: "linear" }}
        >
          <path d={WAVE} fill={c.fill} />
        </motion.svg>
      ))}
    </div>
  );
}

export function CountdownHero({
  target,
  local,
}: {
  target: string;
  local?: string | null;
}) {
  const [t, setT] = useState<Parts>(() => parts(new Date(target)));
  const reduzir = useReducedMotion();

  useEffect(() => {
    const id = setInterval(() => setT(parts(new Date(target))), 1000);
    return () => clearInterval(id);
  }, [target]);

  const data = new Date(target).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <section className="relative isolate overflow-hidden rounded-3xl shadow-soft">
      {/* ceu: noite no topo, oceano embaixo */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#04283A_0%,#0B4F6C_58%,#1B6B93_100%)]" />

      {/* sol difuso atras dos digitos */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-2 mx-auto h-64 w-64 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgba(255,215,0,0.38) 0%, rgba(255,215,0,0.10) 45%, rgba(255,215,0,0) 72%)",
        }}
      />

      {/* disco do sol tocando o horizonte */}
      <div
        aria-hidden
        className="absolute bottom-9 left-1/2 h-14 w-14 -translate-x-1/2 rounded-full bg-gold-neon/90 blur-[2px]"
      />

      <Waves still={!!reduzir} />

      <div className="relative z-10 px-6 pb-12 pt-7 text-center">
        <p className="font-display text-[11px] font-medium uppercase tracking-[0.42em] text-gold-neon/90">
          {data.replaceAll("/", " · ")}
        </p>

        <div className="mt-6 flex items-start justify-center gap-1">
          {UNITS.map(({ key, label }, i) => (
            <div key={key} className="flex items-start">
              <div className="flex w-[62px] flex-col items-center">
                <motion.span
                  key={t[key]}
                  initial={reduzir ? false : { y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="font-display text-[38px] font-bold leading-none tabular-nums text-sand-50 drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
                >
                  {String(t[key]).padStart(2, "0")}
                </motion.span>
                <span className="mt-2 text-[10px] uppercase tracking-[0.18em] text-sand-100/70">
                  {label}
                </span>
              </div>
              {i < UNITS.length - 1 && (
                <span
                  aria-hidden
                  className="mt-1 font-display text-[30px] font-light leading-none text-sand-100/25"
                >
                  :
                </span>
              )}
            </div>
          ))}
        </div>

        {local && (
          <p className="mt-6 text-xs font-medium tracking-wide text-sand-100/75">{local}</p>
        )}
      </div>
    </section>
  );
}
