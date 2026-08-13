import type { Metadata } from "next";
import { LogOut, Lock } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/perfil/profile-form";
import { PasswordForm } from "@/components/perfil/password-form";
import { AdminMembers } from "@/components/perfil/admin-members";

export const metadata: Metadata = { title: "Perfil · Réveillon Búzios" };

export default async function PerfilPage() {
  const user = await getCurrentUser();
  const p = user!.profile;

  const provedores = (user!.app_metadata?.providers as string[] | undefined) ?? [];
  const temSenha = provedores.includes("email");
  const temGoogle = provedores.includes("google");

  const iniciais = (p.nickname || p.full_name)
    .split(" ")
    .slice(0, 2)
    .map((x: string) => x.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary font-display text-xl font-bold text-primary-foreground">
          {iniciais}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold">{p.full_name}</h1>
          <p className="truncate text-sm text-muted-foreground">{p.email}</p>
        </div>
      </header>

      {p.is_admin && <AdminMembers userId={p.id} />}

      <ProfileForm
        userId={p.id}
        inicial={{
          full_name: p.full_name,
          nickname: p.nickname,
          phone: p.phone,
          pix_key: p.pix_key,
        }}
      />

      {/* E-mail travado: e ele que autoriza a entrada no grupo. */}
      <section className="card-soft p-5">
        <h2 className="font-display font-semibold">E-mail de acesso</h2>
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm">{p.email}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Não dá para trocar: é este e-mail que foi autorizado no grupo.
        </p>

        {(temGoogle || temSenha) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {temGoogle && (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                Conectado com Google
              </span>
            )}
            {temSenha && (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                Entra com senha
              </span>
            )}
          </div>
        )}
      </section>

      <PasswordForm email={p.email} temSenha={temSenha} />

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-semibold text-destructive transition active:scale-[0.99]"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sair da conta
        </button>
      </form>
    </div>
  );
}
