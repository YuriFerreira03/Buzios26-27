import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { LevarList } from "@/components/levar/levar-list";
import type { Member } from "@/types/app";

export const metadata: Metadata = { title: "Levar · Réveillon Búzios" };

export default async function LevarPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data } = await supabase
    .from("users")
    .select("id, full_name, nickname")
    .order("full_name");

  const membros = (data as Member[] | null) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Levar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que cada um fica de levar. Marque quando já estiver na mala.
        </p>
      </header>

      <LevarList userId={user!.id} membros={membros} />
    </div>
  );
}
