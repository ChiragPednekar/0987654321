import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";

/**
 * Only personal and administrative surfaces require a session.
 *
 * Browsing the library, paths, contests and the leaderboard is deliberately
 * public — it is the top of the funnel, and RLS already limits anonymous reads
 * to published rows. Submitting an answer requires auth, enforced in the API
 * route and by RLS, not here.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/profile",
  "/settings",
  "/bookmarks",
  "/notifications",
  "/progress",
  "/groups",
  "/classrooms",
  "/institution",
  "/teacher",
  "/teach",
  "/admin",
  "/recruiter",
];

const AUTH_ROUTES = ["/login", "/signup"];

/**
 * Refreshes the auth cookie on every request and gates protected routes.
 *
 * Note: this is a coarse gate for UX (bounce signed-out users to /login).
 * It is not the security boundary — RLS is.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not remove: this refreshes the session token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Unauthenticated user trying to reach a protected area -> bounce to /login
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const isAuthRoute = AUTH_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Authenticated user hitting login/signup -> send to dashboard (unless error or logout param present)
  if (user && isAuthRoute) {
    if (
      request.nextUrl.searchParams.has("error") ||
      request.nextUrl.searchParams.has("logout")
    ) {
      return response;
    }
    const nextParam = request.nextUrl.searchParams.get("next");
    const isSafeNext =
      nextParam &&
      nextParam.startsWith("/") &&
      !AUTH_ROUTES.some((p) => nextParam.startsWith(p));
    const url = request.nextUrl.clone();
    url.pathname = isSafeNext ? nextParam : "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Admin area: check the role, not just the session.
  if (user && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && profile.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
