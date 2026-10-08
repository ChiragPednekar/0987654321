import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Crucially this DOES
     * include /api routes so the session cookie is refreshed for them too.
     *
     * /proctor/ is excluded: it holds the camera-check runtime and models,
     * which are static open-source files. Left in, the invite-only gate sent
     * every .wasm and .tflite request through an access RPC — or, signed out,
     * redirected it to /login — so the camera's ability to start depended on
     * auth answering six asset requests in a row.
     */
    "/((?!_next/static|_next/image|favicon.ico|proctor/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
