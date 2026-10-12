import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Routes another site legitimately POSTs to. Razorpay's webhook is signed and
 * carries no session, so an origin check means nothing to it.
 */
const CROSS_SITE_ALLOWED = ["/api/billing/webhook"];

/**
 * Refuses a state-changing API request that another website started.
 *
 * The session cookie is SameSite=Lax, so the browser already leaves it off a
 * cross-site POST — this is the second lock on the same door, for the browsers
 * and edge cases where the first one does not hold. It reads what the browser
 * says about where the request came from, which a page cannot forge:
 * Sec-Fetch-Site where sent (every current browser), otherwise Origin.
 *
 * A request with neither header is let through. That is a script or a tool,
 * not a browser on another site, and it carries no victim's cookie to abuse —
 * the route's own authentication decides it like any other.
 */
function isCrossSiteWrite(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return false;
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  if (CROSS_SITE_ALLOWED.includes(pathname)) return false;

  const site = request.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";

  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

/**
 * Next 16 renamed middleware to proxy: same job, new name, and it always runs
 * on the Node.js runtime. The session refresh and every gate it applies live
 * in updateSession (src/lib/supabase/middleware.ts), unchanged by the rename.
 */
export async function proxy(request: NextRequest) {
  if (isCrossSiteWrite(request)) {
    return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  }
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
