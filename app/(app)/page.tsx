import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { CountdownHero } from "@/components/dashboard/countdown-hero";
import { HomePanel } from "@/components/dashboard/home-panel";
import { NoticesCard, type Notice } from "@/components/dashboard/notices-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const [settingsRes, noticesRes] = await Promise.all([
    supabase.from("trip_settings").select("*").single(),
    supabase
      .from("notices")
      .select("id, title, body")
      .eq("pinned", true)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const settings = settingsRes.data as {
    countdown_target: string;
    house_name: string | null;
    check_in: string | null;
    check_out: string | null;
  } | null;

  const avisos = (noticesRes.data as Notice[] | null) ?? [];

  return (
    <div className="space-y-5">
      <CountdownHero
        checkIn={settings?.check_in ?? null}
        checkOut={settings?.check_out ?? null}
        virada={settings?.countdown_target ?? "2026-12-31T20:00:00-03:00"}
        casa={settings?.house_name ?? null}
      />

      <NoticesCard avisos={avisos} />

      <HomePanel userId={user!.id} />
    </div>
  );
}
