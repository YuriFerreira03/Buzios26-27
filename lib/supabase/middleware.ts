import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rotas que nao exigem sessao. */
const PUBLIC_PATHS = ["/login", "/cadastro", "/auth"];

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  let approved = false;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("approved")
      .eq("id", user.id)
      .maybeSingle();
    approved = !!(data as { approved: boolean } | null)?.approved;
  }

  /** Redirect preservando os cookies renovados pelo getUser(). */
  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  // Sem sessao: so rotas publicas.
  if (!user && !isPublic && pathname !== "/aguardando") return redirectTo("/login");

  // Com sessao mas sem aprovacao: fica preso em /aguardando.
  if (user && !approved && pathname !== "/aguardando" && !pathname.startsWith("/auth")) {
    return redirectTo("/aguardando");
  }

  // Aprovado nao volta para telas de entrada.
  if (user && approved && ["/login", "/cadastro", "/aguardando"].includes(pathname)) {
    return redirectTo("/");
  }

  return response;
}