"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const campo =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none transition focus:border-accent";

export function ProfileForm({
  userId,
  inicial,
}: {
  userId: string;
  inicial: {
    full_name: string;
    nickname: string | null;
    phone: string | null;
    pix_key: string | null;
  };
}) {
  const router = useRouter();

  const [nome, setNome] = useState(inicial.full_name);
  const [apelido, setApelido] = useState(inicial.nickname ?? "");
  const [telefone, setTelefone] = useState(inicial.phone ?? "");
  const [pix, setPix] = useState(inicial.pix_key ?? "");
  const [salvando, setSalvando] = useState(false);

  const mudou =
    nome !== inicial.full_name ||
    apelido !== (inicial.nickname ?? "") ||
    telefone !== (inicial.phone ?? "") ||
    pix !== (inicial.pix_key ?? "");

  const valido = nome.trim().length >= 2;

  async function salvar() {
    setSalvando(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("users")
      .update({
        full_name: nome.trim(),
        nickname: apelido.trim() || null,
        phone: telefone.trim() || null,
        pix_key: pix.trim() || null,
      })
      .eq("id", userId);

    setSalvando(false);

    if (error) {
      toast.error("Não deu para salvar", { description: error.message });
      return;
    }

    toast.success("Perfil atualizado");
    router.refresh();
  }

  return (
    <section className="card-soft space-y-4 p-5">
      <h2 className="font-display font-semibold">Seus dados</h2>

      <div className="space-y-1.5">
        <label htmlFor="nome" className="text-sm font-medium">
          Nome
        </label>
        <input id="nome" className={campo} value={nome} onChange={(e) => setNome(e.target.value)} />
        {!valido && <p className="text-sm text-destructive">Informe pelo menos 2 letras.</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="apelido" className="text-sm font-medium">
          Como te chamam <span className="text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="apelido"
          className={campo}
          placeholder="o apelido que aparece nas listas"
          value={apelido}
          onChange={(e) => setApelido(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="telefone" className="text-sm font-medium">
          Celular <span className="text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="telefone"
          type="tel"
          inputMode="tel"
          className={campo}
          placeholder="(11) 99999-9999"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pix" className="text-sm font-medium">
          Chave Pix <span className="text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="pix"
          className={campo}
          placeholder="para o pessoal te pagar mais rápido"
          value={pix}
          onChange={(e) => setPix(e.target.value)}
        />
      </div>

      <button
        onClick={salvar}
        disabled={!mudou || !valido || salvando}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {mudou ? "Salvar alterações" : "Tudo salvo"}
      </button>
    </section>
  );
}
