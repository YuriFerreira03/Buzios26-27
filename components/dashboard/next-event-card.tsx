import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";

export type ScheduleItem = {
  id: string;
  day: string;
  starts_at: string | null;
  title: string;
  location: string | null;
};

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function NextEventCard({ evento }: { evento: ScheduleItem | null }) {
  if (!evento) {
    return (
      <Link href="/programacao" className="card-soft block p-5 transition active:scale-[0.99]">
        <p className="text-sm text-muted-foreground">Programação</p>
        <p className="mt-1 text-sm">
          Ainda não tem nada marcado.{" "}
          <span className="font-medium text-secondary underline underline-offset-4">
            Montar o roteiro
          </span>
        </p>
      </Link>
    );
  }

  const d = new Date(`${evento.day}T12:00:00`);
  const rotulo = `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1,
  ).padStart(2, "0")}`;

  return (
    <Link href="/programacao" className="card-soft block p-5 transition active:scale-[0.99]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-secondary" aria-hidden />
          <div>
            <p className="text-sm text-muted-foreground">Próximo da agenda</p>
            <p className="mt-0.5 font-display font-semibold">{evento.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {rotulo}
              {evento.starts_at ? ` · ${evento.starts_at.slice(0, 5)}` : ""}
              {evento.location ? ` · ${evento.location}` : ""}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </Link>
  );
}
