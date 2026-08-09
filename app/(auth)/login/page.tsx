import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · Réveillon Búzios" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      {/* Horizonte: oceano no topo, areia embaixo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-ocean-900 via-ocean-700 to-transparent"
      />

      <div className="relative z-10 w-full max-w-sm">
        <header className="mb-10 text-center">
          <p className="font-display text-xs uppercase tracking-[0.35em] text-gold">
            31.12.2026
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-sand-50 drop-shadow">
            Réveillon
            <br />
            <span className="text-gold-neon">Búzios</span>
          </h1>
          <p className="mt-4 text-sm text-sand-100/90">
            Grupo fechado. Só os oito entram.
          </p>
        </header>

        <div className="card-soft p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
