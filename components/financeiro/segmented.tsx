"use client";

import { motion } from "framer-motion";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  layoutId,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  layoutId: string;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1 rounded-2xl border border-border/60 bg-muted/60 p-1"
    >
      {options.map((o) => {
        const ativo = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange(o.value)}
            className="relative flex-1 rounded-xl px-3 py-2 text-sm font-medium transition"
          >
            {ativo && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-card shadow-sm"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className={`relative ${ativo ? "text-primary" : "text-muted-foreground"}`}>
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
