import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** Perfil em public.users. Espelha o schema.sql. */
export type Profile = {
  id: string;
  email: string;
  full_name: string;
  nickname: string | null;
  avatar_path: string | null;
  phone: string | null;
  pix_key: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Cliente Supabase para Server Components, Route Handlers e Server Actions.
 * Sempre criar um novo por request (nunca reaproveitar entre requisicoes).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component: o middleware ja cuida
            // da renovacao do cookie de sessao. Seguro ignorar.
          }
        },
      },
    },
  );
}

/** Retorna o usuario autenticado + perfil, ou null. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase.from("users").select("*").eq("id", user.id).single();

  const profile = data as Profile | null;

  return profile ? { ...user, profile } : null;
}
