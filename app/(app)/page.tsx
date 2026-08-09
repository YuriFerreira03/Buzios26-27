import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { CountdownHero } from "@/components/dashboard/countdown-hero";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { MyRentCard } from "@/components/dashboard/my-rent-card";
import { NoticesCard, type Notice } from "@/components/dashboard/notices-card";
import { NextEventCard, type ScheduleItem } from "@/components/dashboard/next-event-card";
import type { Balance, RentInstallment } from "@/types/app";

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const hoje = new Date().toISOString().slice(0, 10);

  const [settingsRes, balanceRes, noticesRes, scheduleRes, rentRes] = await Promise.all([
    supabase.from("trip_settings").select("*").single(),
    supabase.from("v_common_fund_balance").select("*").single(),
    supabase.from("notices").select("id, title, body").eq("pinned", true).order("created_at", { ascending: false }).limit(3),
    supabase.from("schedule").select("id, day, starts_at, title, location").gte("day", hoje).order("day").order("starts_at", { nullsFirst: false }).limit(1),
    supabase.from("rent_installments").select("*").eq("user_id", user!.id).order("reference_month"),
  ]);

  const settings = settingsRes.data as
    | { countdown_target: string; house_name: string | null; check_in: string | null; check_out: string | null }
    | null;

  const saldo = (balanceRes.data as Balance | null) ?? { total_in: 0, total_out: 0, balance: 0 };
  const avisos = (noticesRes.data as Notice[] | null) ?? [];
  const proximo = ((scheduleRes.data as ScheduleItem[] | null) ?? [])[0] ?? null;
  const parcelas = (rentRes.data as RentInstallment[] | null) ?? [];

  const local = settings?.house_name ?? "Búzios · RJ";

  return (
    <div className="space-y-5">
      <CountdownHero
        target={settings?.countdown_target ?? "2026-12-31T20:00:00-03:00"}
        local={local}
      />

      <NoticesCard avisos={avisos} />

      <BalanceCard inicial={saldo} />

      <MyRentCard userId={user!.id} inicial={parcelas} />

      <NextEventCard evento={proximo} />
    </div>
  );
}
