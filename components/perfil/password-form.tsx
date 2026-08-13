"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none transition focus:border-accent";

export function PasswordForm({
  email,
  temSenha,
}: {
  email: string;
  /** false quando a conta so tem login social. */
  temSenha: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [salvando, setSalvando] = useState(false);

  const valido =
    nova.length >= 8 && nova === confirma && (!temSenha || atual.length > 0);

  async function salvar() {
    setSalvando(true);
    const supabase = createClient();

    // Confere a senha atual antes de trocar: sessao aberta no celular de
    // outra pessoa nao deve conseguir mudar a senha sozinha.
    if (temSenha) {
      const { error: erroLogin } = await supabase.auth.signInWithPassword({
        email,
        password: atual,
      });

      if (erroLogin) {
        setSalvando(false);
        toast.error("Senha atual incorreta");
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: nova });
    setSalvando(false);

    if (error) {
      toast.error("Não deu para trocar a senha", { description: error.message });
      return;
    }

    toast.success(temSenha ? "Senha alterada" : "Senha criada");
    setAtual("");
    setNova("");
    setConfirma("");
    setAberto(false);
  }

  if (!aberto) {
    return (
      <section className="card-soft p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold">Senha</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {temSenha
                ? "Troque quando quiser."
                : "Você entra pelo Google. Crie uma senha se quiser outra forma de entrar."}
            </p>
          </div>
          <button
            onClick={() => setAberto(true)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden />
            {temSenha ? "Trocar" : "Criar"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card-soft space-y-4 p-5">
      <h2 className="font-display font-semibold">{temSenha ? "Trocar senha" : "Criar senha"}</h2>

      {temSenha && (
        <div className="space-y-1.5">
          <label htmlFor="atual" className="text-sm font-medium">
            Senha atual
          </label>
          <input
            id="atual"
            type="password"
            autoComplete="current-password"
            className={campo}
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="nova" className="text-sm font-medium">
          Nova senha
        </label>
        <input
          id="nova"
          type="password"
          autoComplete="new-password"
          placeholder="mínimo 8 caracteres"
          className={campo}
          value={nova}
          onChange={(e) => setNova(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirma" className="text-sm font-medium">
          Repita a nova senha
        </label>
        <input
          id="confirma"
          type="password"
          autoComplete="new-password"
          className={campo}
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
        />
        {confirma.length > 0 && nova !== confirma && (
          <p className="text-sm text-destructive">As senhas não batem.</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setAberto(false)}
          className="h-11 flex-1 rounded-xl border border-border text-sm font-medium"
        >
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={!valido || salvando}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Salvar
        </button>
      </div>
    </section>
  );
}
