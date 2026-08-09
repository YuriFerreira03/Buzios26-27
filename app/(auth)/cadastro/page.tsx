"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  full_name: z.string().min(2, "Como você quer ser chamado?"),
  email: z.string().min(1, "Informe seu e-mail.").email("E-mail inválido.")
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, "Use pelo menos 8 caracteres."),
});

type FormData = z.infer<typeof schema>;

const campo =
  "h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none transition focus:border-accent";

export default function CadastroPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit({ full_name, email, password }: FormData) {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name } },
    });

    if (error) {
      toast.error("Não foi possível criar a conta", { description: error.message });
      return;
    }

    router.push("/aguardando");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 font-display text-2xl font-bold">Criar conta</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Depois de criar, o Yuri libera seu acesso ao grupo.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="card-soft space-y-4 p-6" noValidate>
        <div className="space-y-2">
          <label htmlFor="full_name" className="text-sm font-medium">Seu nome</label>
          <input id="full_name" className={campo} placeholder="Como te chamam" {...register("full_name")} />
          {errors.full_name && <p role="alert" className="text-sm text-destructive">{errors.full_name.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">E-mail</label>
          <input id="email" type="email" inputMode="email" autoComplete="email"
            className={campo} placeholder="voce@exemplo.com" {...register("email")} />
          {errors.email && <p role="alert" className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">Senha</label>
          <input id="password" type="password" autoComplete="new-password"
            className={campo} placeholder="mínimo 8 caracteres" {...register("password")} />
          {errors.password && <p role="alert" className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition hover:bg-secondary disabled:opacity-60">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSubmitting ? "Criando..." : "Criar conta"}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-secondary underline underline-offset-4">Entrar</Link>
        </p>
      </form>
    </main>
  );
}