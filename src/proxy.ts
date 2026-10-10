import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next 16 renamed middleware to proxy: same job, new name, and it always runs
 * on the Node.js runtime. The session refresh and every gate it applies live
 * in updateSession (src/lib/supabase/middleware.ts), unchanged by the rename.
 */
export async function proxy(request: NextRequest) {
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
