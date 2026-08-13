import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { CountdownHero } from "@/components/dashboard/countdown-hero";
import {
  BalanceCard,
  type SaldoUsuario,
} from "@/components/dashboard/balance-card";
import { MyRentCard } from "@/components/dashboard/my-rent-card";
import { NoticesCard, type Notice } from "@/components/dashboard/notices-card";
import {
  NextEventCard,
  type ScheduleItem,
} from "@/components/dashboard/next-event-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const hoje = new Date().toISOString().slice(0, 10);

  const [settingsRes, saldoRes, noticesRes, scheduleRes] = await Promise.all([
    supabase.from("trip_settings").select("*").single(),
    supabase
      .from("v_user_balances")
      .select("saldo, total_pago, total_devido")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("notices")
      .select("id, title, body")
      .eq("pinned", true)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("schedule")
      .select("id, day, starts_at, title, location")
      .gte("day", hoje)
      .order("day")
      .order("starts_at", { nullsFirst: false })
      .limit(1),
  ]);

  const settings = settingsRes.data as {
    countdown_target: string;
    house_name: string | null;
  } | null;
  const saldo = (saldoRes.data as SaldoUsuario | null) ?? null;
  const avisos = (noticesRes.data as Notice[] | null) ?? [];
  const proximo =
    ((scheduleRes.data as ScheduleItem[] | null) ?? [])[0] ?? null;
  return (
    <div className="space-y-5">
      <CountdownHero
        target={settings?.countdown_target ?? "2026-12-31T20:00:00-03:00"}
        local={settings?.house_name ?? "Búzios · RJ"}
      />

      <NoticesCard avisos={avisos} />

      <BalanceCard userId={user!.id} inicial={saldo} />

      <MyRentCard userId={user!.id} />

      <NextEventCard evento={proximo} />
    </div>
  );
}
