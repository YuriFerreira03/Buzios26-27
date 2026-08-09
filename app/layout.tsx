import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Segunda camada de protecao (a primeira e o middleware).
  // Sem perfil em public.users, a pessoa nao e do grupo.
  if (!user) redirect("/login");

  return (
    <div className="min-h-dvh pb-24">
      <AppHeader name={user.profile.full_name} />
      <main className="mx-auto max-w-lg px-5 py-6">{children}</main>
      <BottomNav />
    </div>
  );
}
