"use client";

import { useEffect, useState } from "react";

function diff(target: Date) {
  const ms = Math.max(0, target.getTime() - Date.now());
  return {
    dias: Math.floor(ms / 86_400_000),
    horas: Math.floor((ms / 3_600_000) % 24),
    min: Math.floor((ms / 60_000) % 60),
    seg: Math.floor((ms / 1000) % 60),
  };
}

export function Countdown({ target }: { target: string }) {
  const date = new Date(target);
  const [time, setTime] = useState(() => diff(date));

  useEffect(() => {
    const id = setInterval(() => setTime(diff(date)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return (
    <div className="mt-4 flex items-end justify-center gap-4 tabular-nums">
      {(["dias", "horas", "min", "seg"] as const).map((unit) => (
        <div key={unit} className="flex flex-col items-center">
          <span className="font-display text-4xl font-bold leading-none text-gold-neon">
            {String(time[unit]).padStart(2, "0")}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-widest text-sand-100/80">
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}
