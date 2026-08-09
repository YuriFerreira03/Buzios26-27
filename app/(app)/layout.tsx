import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // getCurrentUser so devolve perfil aprovado.
  // Sem sessao ou sem aprovacao, o middleware ja redirecionou;
  // esta linha e a segunda camada, caso ele seja contornado.
  if (!user) redirect("/login");

  return (
    <div className="min-h-dvh pb-24">
      <AppHeader name={user.profile.full_name} />
      <main className="mx-auto max-w-lg px-5 py-6">{children}</main>
      <BottomNav />
    </div>
  );
}