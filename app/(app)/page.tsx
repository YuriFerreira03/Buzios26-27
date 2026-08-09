import { createClient } from "@/lib/supabase/server";
import { Countdown } from "@/components/shared/countdown";
import { brl } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [settingsRes, balanceRes] = await Promise.all([
    supabase.from("trip_settings").select("*").single(),
    supabase.from("v_common_fund_balance").select("*").single(),
  ]);

  const settings = settingsRes.data as { countdown_target: string } | null;
  const balance = balanceRes.data as { balance: number } | null;

  return (
    <div className="space-y-6">
      <section className="card-soft overflow-hidden">
        <div className="bg-gradient-to-br from-ocean-900 to-ocean-700 px-6 py-8 text-center text-sand-50">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Falta pouco</p>
          <Countdown target={settings?.countdown_target ?? "2026-12-31T20:00:00-03:00"} />
        </div>
      </section>

      <section className="card-soft p-5">
        <p className="text-sm text-muted-foreground">Saldo da caixinha</p>
        <p className="font-display text-3xl font-bold text-primary">
          {brl(balance?.balance ?? 0)}
        </p>
      </section>

      {/* Fase 2: proximo evento da programacao e alertas fixados entram aqui. */}
    </div>
  );
}
