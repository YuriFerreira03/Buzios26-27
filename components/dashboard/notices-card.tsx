import { Pin } from "lucide-react";

export type Notice = { id: string; title: string; body: string | null };

export function NoticesCard({ avisos }: { avisos: Notice[] }) {
  if (avisos.length === 0) return null;

  return (
    <section className="space-y-3">
      {avisos.map((a) => (
        <article
          key={a.id}
          className="rounded-2xl border border-accent/30 bg-accent/10 p-4 pl-5"
        >
          <div className="flex items-start gap-2.5">
            <Pin className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <div>
              <h2 className="font-display text-sm font-semibold">{a.title}</h2>
              {a.body && <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
