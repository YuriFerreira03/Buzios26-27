import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Timeline } from "@/components/roteiro/timeline";
import type { Member } from "@/types/app";

export const metadata: Metadata = { title: "Roteiro · Réveillon Búzios" };

export default async function ProgramacaoPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const [membrosRes, settingsRes] = await Promise.all([
    supabase.from("users").select("id, full_name, nickname").order("full_name"),
    supabase.from("trip_settings").select("check_in, check_out").single(),
  ]);

  const membros = (membrosRes.data as Member[] | null) ?? [];
  const settings = settingsRes.data as { check_in: string | null; check_out: string | null } | null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Roteiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que rola em cada dia e quem topa. Qualquer um edita.
        </p>
      </header>

      <Timeline
        userId={user!.id}
        membros={membros}
        checkIn={settings?.check_in ?? null}
        checkOut={settings?.check_out ?? null}
      />
    </div>
  );
}
