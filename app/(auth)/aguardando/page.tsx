import { Clock } from "lucide-react";

export default function AguardandoPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <Clock className="h-12 w-12 text-accent" aria-hidden />
      <h1 className="font-display text-2xl font-bold">Conta criada</h1>
      <p className="text-muted-foreground">
        Agora é só esperar o Yuri liberar seu acesso. Assim que ele aprovar, é
        só entrar normalmente com seu e-mail e senha ou conta google.
      </p>

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="text-sm font-medium text-secondary underline underline-offset-4"
        >
          Sair
        </button>
      </form>
    </main>
  );
}
