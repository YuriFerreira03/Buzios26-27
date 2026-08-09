# Réveillon Búzios — Fase 1 (Fundação)

PWA mobile-first para os 8 organizarem a virada. Next.js 14 (App Router) + Supabase + Vercel.

O que já está aqui: projeto configurado, design system, autenticação por magic link com allowlist
dupla, schema completo com RLS, shell do app (header + bottom nav) e dashboard com contagem
regressiva ligada no banco.

---

## 1. Arquitetura de pastas

```
reveillon-buzios/
├── app/
│   ├── (auth)/                     # Rotas sem o shell do app
│   │   └── login/
│   │       ├── page.tsx            # Server Component (layout da tela)
│   │       └── login-form.tsx      # Client Component (RHF + Zod + magic link)
│   ├── (app)/                      # Rotas privadas (header + bottom nav)
│   │   ├── layout.tsx              # Guarda de sessão + shell
│   │   ├── page.tsx                # Dashboard
│   │   ├── financeiro/             # Fase 2 — aluguel + caixinha
│   │   ├── compras/                # Fase 2 — lista em tempo real
│   │   ├── roleta/                 # Fase 3
│   │   ├── programacao/            # Fase 3
│   │   ├── feed/                   # Fase 4
│   │   ├── perolas/                # Fase 4
│   │   └── perfil/
│   ├── auth/
│   │   ├── callback/route.ts       # Troca o link por sessão (code ou token_hash)
│   │   └── signout/route.ts
│   ├── globals.css                 # Tokens da paleta (HSL, padrão shadcn)
│   └── layout.tsx                  # Fontes, metadata PWA, Toaster
│
├── components/
│   ├── ui/                         # shadcn/ui (gerado pela CLI)
│   ├── layout/                     # app-header.tsx, bottom-nav.tsx
│   └── shared/                     # countdown.tsx e demais peças reutilizáveis
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # createBrowserClient (Client Components)
│   │   ├── server.ts               # createServerClient + getCurrentUser()
│   │   └── middleware.ts           # updateSession() — renova cookie e protege rotas
│   └── utils.ts                    # cn() e brl()
│
├── hooks/                          # useRealtime, useShoppingList... (Fase 2+)
├── types/database.types.ts         # Gerado pelo Supabase CLI
├── supabase/
│   ├── schema.sql                  # Tabelas, RLS, triggers, views, storage
│   └── seed.sql                    # Allowlist dos 8 + config da viagem
├── public/
│   ├── manifest.json
│   └── icons/                      # icon-192, icon-512, icon-maskable-512
├── middleware.ts                   # Entrada do middleware (chama updateSession)
├── next.config.mjs                 # next-pwa
├── tailwind.config.ts              # Paleta ocean/sand/gold + fontes
└── .env.local.example
```

**Convenção:** leitura de dados em Server Component sempre que possível; Client Component só
onde há interação, animação ou Realtime. O sufixo do arquivo (`-form`, `-list`) indica a peça
client dentro de uma rota server.

---

## 2. Banco de dados

Tudo está em `supabase/schema.sql`. Resumo das decisões:

| Área | Tabelas |
|---|---|
| Acesso | `allowlist`, `users` |
| Viagem | `trip_settings`, `notices` |
| Financeiro | `rent_installments`, `common_fund_transactions` |
| Compras | `shopping_list` |
| Feed | `albums`, `feed_posts`, `feed_media`, `photo_tags` |
| Social | `quotes`, `comments`, `reactions` |
| Roteiro | `schedule` |
| Roleta | `roulette_draws`, `roulette_results` |

Pontos que valem atenção:

- **Allowlist em duas camadas.** No client, `signInWithOtp` roda com `shouldCreateUser: false`.
  No banco, o trigger `handle_new_auth_user` levanta exceção se o e-mail não estiver em
  `allowlist` — ou seja, nem chamando a API direto alguém entra.
- **RLS em todas as tabelas**, sempre via `public.is_member()`, que é `SECURITY DEFINER` (evita
  recursão ao consultar `public.users` dentro da própria policy). Nenhuma tabela tem policy para
  o papel `anon`: anônimo não lê nada.
- **`allowlist` não tem policy nenhuma** — só o trigger acessa. Fechada até para autenticados.
- **Parcela do aluguel:** leitura é coletiva (todo mundo vê a situação de todo mundo), mas o
  `UPDATE` é restrito a `user_id = auth.uid()`. `paid_at` e `confirmed_by` são carimbados por
  trigger no servidor, não pelo client. Para permitir baixa cruzada, troque o `using` da policy
  `rent_update_own` por `public.is_member()`.
- **`feed_media` separada de `feed_posts`** para suportar upload múltiplo (um post, várias fotos)
  sem duplicar legenda, comentários e reações.
- **`comments` e `reactions` servem posts e pérolas** com duas FKs anuláveis e um
  `CHECK (num_nonnulls(post_id, quote_id) = 1)` — mantém integridade referencial de verdade,
  ao contrário de um `target_id` polimórfico.
- **Dinheiro em `numeric(12,2)`**, nunca `float`.
- **Realtime** habilitado nas tabelas colaborativas, com `replica identity full` onde o app
  precisa do registro completo em UPDATE/DELETE.
- **Storage:** três buckets privados (`photos`, `receipts`, `avatars`). Leitura só para membros;
  update/delete só para o dono do arquivo.

---

## 3. Setup — passo a passo

### 3.1 Projeto local

```bash
# Se for começar do zero:
npx create-next-app@latest reveillon-buzios --ts --tailwind --app --src-dir=false --import-alias "@/*"

# Ou apenas use esta pasta e instale:
cd reveillon-buzios
npm install

npx shadcn@latest init          # escolha: New York, base color Slate, CSS variables: yes
npx shadcn@latest add button card input label dialog tabs select skeleton avatar sonner
```

> Ao rodar o `shadcn init`, ele vai querer sobrescrever `app/globals.css` e `tailwind.config.ts`.
> Deixe sobrescrever e depois recoloque os blocos de paleta deste repositório — são eles que
> definem azul oceano / areia / dourado.

### 3.2 Projeto Supabase

1. [database.new](https://database.new) → região **South America (São Paulo)**, senha forte.
2. **SQL Editor** → cole `supabase/schema.sql` inteiro → **Run**. Deve terminar sem erro.
3. **SQL Editor** → abra `supabase/seed.sql`, troque os 8 e-mails e nomes pelos reais → **Run**.
4. **Authentication → Providers → Email**:
   - Ligue *Email*, desligue *Confirm email* (magic link não precisa) e desligue **Enable email
     signups** se quiser uma trava extra.
   - Desligue todos os outros providers.
5. **Authentication → URL Configuration**:
   - *Site URL*: `http://localhost:3000` (troque pela URL da Vercel após o deploy).
   - *Redirect URLs*: adicione `http://localhost:3000/auth/callback` e
     `https://SEU-APP.vercel.app/auth/callback`.
6. **Authentication → Email Templates → Magic Link** — troque o link do template por:

   ```
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/
   ```

   (opcional — a rota `/auth/callback` também aceita o formato padrão `?code=`, então manter o
   template original funciona igual.)
7. **Authentication → Rate Limits**: reduza o envio de e-mails para algo como 10/hora. São 8
   pessoas, não precisa mais que isso.

> **SMTP:** o servidor de e-mail nativo do Supabase tem limite baixo e cai em spam. Para 8
> pessoas dá para começar assim, mas configure um SMTP próprio (Resend, Brevo) em
> *Project Settings → Authentication → SMTP* antes de dezembro.

### 3.3 Variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Preencha com *Project Settings → API*:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

A `anon key` é pública por natureza — quem protege os dados é a RLS. A **`service_role` key nunca
entra neste projeto**, nem em variável de servidor.

### 3.4 Tipos do banco

```bash
npx supabase login
npx supabase gen types typescript --project-id <SEU_PROJECT_ID> --schema public > types/database.types.ts
```

Isso substitui o placeholder e liga o autocomplete tipado em todas as queries.

### 3.5 Ícones do PWA

Gere `icon-192.png`, `icon-512.png` e `icon-maskable-512.png` em `public/icons/`
(fundo `#0B4F6C`, símbolo dourado). Sem eles o app não fica instalável.

### 3.6 Rodar

```bash
npm run dev
```

Teste em `http://localhost:3000` num viewport de 375px. Fluxo esperado: `/` redireciona para
`/login` → e-mail da allowlist recebe o link → clique → volta autenticado no dashboard.
Um e-mail fora da lista deve falhar no envio.

### 3.7 Deploy na Vercel

```bash
git init && git add . && git commit -m "fase 1: fundação"
gh repo create reveillon-buzios --private --source=. --push   # ou suba pela interface
```

1. [vercel.com/new](https://vercel.com/new) → importe o repositório (framework detectado
   automaticamente).
2. *Environment Variables*: cole as três variáveis do `.env.local` para **Production**,
   **Preview** e **Development**.
3. Deploy.
4. Volte ao Supabase e atualize *Site URL* e *Redirect URLs* com o domínio final da Vercel.
5. Abra no celular → menu do navegador → **Adicionar à tela de início**.

---

## 4. Checklist de saída da Fase 1

- [ ] `schema.sql` rodou limpo e as 17 tabelas aparecem no Table Editor
- [ ] Os 8 e-mails estão em `allowlist`
- [ ] Login com e-mail da lista funciona; e-mail de fora é recusado
- [ ] `select * from users` no client anônimo retorna vazio (RLS ativa)
- [ ] Deploy da Vercel abre o dashboard com a contagem regressiva
- [ ] App instalável no iOS e Android

Depois que os 8 fizerem o primeiro login, rode no SQL Editor para criar as parcelas:

```sql
select public.generate_rent_installments(24000.00, '2026-09-01', '2026-12-01', 10);
```

---

## 5. Próximo passo (Fase 2)

Dashboard completo, Financeiro (aluguel + caixinha) e Lista de Compras com Realtime — incluindo
o hook `useRealtimeList`, os formulários com RHF + Zod e os skeleton loaders.
