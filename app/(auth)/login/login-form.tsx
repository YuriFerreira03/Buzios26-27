"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().min(1, "Informe seu e-mail.").email("E-mail inválido.")
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Informe sua senha."),
});

type FormData = z.infer<typeof schema>;

const campo =
  "h-12 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-base outline-none transition focus:border-accent";

export function LoginForm() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit({ email, password }: FormData) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error("E-mail ou senha incorretos", { description: "Confira os dados e tente de novo." });
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">Seu e-mail</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input id="email" type="email" inputMode="email" autoComplete="email"
            placeholder="voce@exemplo.com" className={campo} {...register("email")} />
        </div>
        {errors.email && <p role="alert" className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">Senha</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input id="password" type="password" autoComplete="current-password"
            placeholder="••••••••" className={campo} {...register("password")} />
        </div>
        {errors.password && <p role="alert" className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      <button type="submit" disabled={isSubmitting}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition hover:bg-secondary disabled:opacity-60">
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {isSubmitting ? "Entrando..." : "Entrar"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Primeira vez?{" "}
        <Link href="/cadastro" className="font-medium text-secondary underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </form>
  );
}