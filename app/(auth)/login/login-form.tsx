"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z
    .string()
    .min(1, "Informe seu e-mail.")
    .email("E-mail inválido.")
    .transform((v) => v.trim().toLowerCase()),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const [sent, setSent] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit({ email }: FormData) {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Primeira barreira da allowlist: nao cria usuario novo.
        // A segunda barreira e o trigger handle_new_auth_user no banco.
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

     if (error) {
      console.error("[login]", error);
      const foraDaLista = error.status === 500 ||
        error.message.toLowerCase().includes("database error");

      toast.error(foraDaLista ? "E-mail fora da lista" : "Não foi possível enviar o link", {
        description: foraDaLista
          ? "Só os e-mails cadastrados no grupo têm acesso."
          : error.message,
      });
      return;
    }

    setSent(email);
    toast.success("Link enviado", { description: "Confira sua caixa de entrada." });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle2 className="h-10 w-10 text-accent" aria-hidden />
        <p className="font-display text-lg font-semibold">Link enviado</p>
        <p className="text-sm text-muted-foreground">
          Abra o e-mail em <span className="font-medium text-foreground">{sent}</span> e toque no
          link para entrar. Ele vale por 1 hora.
        </p>
        <button
          type="button"
          onClick={() => setSent(null)}
          className="mt-2 text-sm font-medium text-secondary underline underline-offset-4"
        >
          Usar outro e-mail
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Seu e-mail
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            aria-invalid={!!errors.email}
            className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-base outline-none transition focus:border-accent"
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p role="alert" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition hover:bg-secondary disabled:opacity-60"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {isSubmitting ? "Enviando..." : "Receber link de acesso"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Sem senha. Enviamos um link de uso único para o seu e-mail.
      </p>
    </form>
  );
}
