import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { FinanceiroTabs } from "@/components/financeiro/financeiro-tabs";
import type { Member } from "@/types/app";

export const metadata: Metadata = { title: "Grana · Réveillon Búzios" };

export default async function FinanceiroPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const [membrosRes, settingsRes] = await Promise.all([
    supabase.from("users").select("id, full_name, nickname").order("full_name"),
    supabase.from("trip_settings").select("house_total").single(),
  ]);

  const membros = (membrosRes.data as Member[] | null) ?? [];
  const totalCasa = Number(
    (settingsRes.data as { house_total: number } | null)?.house_total ?? 0,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Grana</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aluguel da casa e caixinha do grupo, atualizados em tempo real.
        </p>
      </header>

      <FinanceiroTabs
        userId={user!.id}
        isAdmin={user!.profile.is_admin}
        membros={membros}
        totalCasa={totalCasa}
      />
    </div>
  );
}
