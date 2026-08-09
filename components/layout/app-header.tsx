import Link from "next/link";
import { UserRound } from "lucide-react";

export function AppHeader({ name }: { name: string }) {
  const firstName = name.split(" ")[0];

  return (
    <header className="glass sticky top-0 z-40 border-b">
      <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Réveillon Búzios
          </p>
          <p className="font-display text-lg font-semibold leading-tight">Oi, {firstName}</p>
        </div>
        <Link
          href="/perfil"
          aria-label="Seu perfil"
          className="grid h-10 w-10 place-items-center rounded-full bg-muted text-primary"
        >
          <UserRound className="h-5 w-5" aria-hidden />
        </Link>
      </div>
    </header>
  );
}
