import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Tudo, exceto arquivos estaticos, imagens, o service worker e o manifest.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
