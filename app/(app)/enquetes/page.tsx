import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PollsList } from "@/components/enquetes/polls-list";
import type { Member } from "@/types/app";

export const metadata: Metadata = { title: "Enquetes · Réveillon Búzios" };

export default async function EnquetesPage() {
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
        <h1 className="font-display text-2xl font-bold">Enquetes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Decidam aqui e fica registrado. Sem rolar o grupo do zap atrás do que ficou combinado.
        </p>
      </header>

      <PollsList userId={user!.id} membros={membros} />
    </div>
  );
}
