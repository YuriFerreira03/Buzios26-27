import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rotas acessiveis sem sessao. */
const PUBLIC_PATHS = ["/login", "/auth"];

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

  /**
   * Redirect preservando os cookies renovados pelo getUser().
   * Sem isso, a sessao renovada se perde e o app entra em loop
   * de redirecionamento entre / e /login.
   */
  const redirectTo = (pathnameTarget: string, keepNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = pathnameTarget;
    url.search = "";
    if (keepNext) url.searchParams.set("next", pathname);

    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && !isPublic) return redirectTo("/login", true);
  if (user && pathname === "/login") return redirectTo("/");

  return response;
}