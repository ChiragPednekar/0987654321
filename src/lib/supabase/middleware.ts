import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";
import { ROLE_HOMES, isForeignHome, roleHome } from "@/lib/role-home";

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
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  /**
   * Role routing.
   *
   * The three dashboards are separate entities. A role's own home is the only
   * one it lands on: an admin who opens /dashboard goes to /admin, a teacher
   * goes to /teacher, and a student who opens either is sent back to
   * /dashboard. Without this every role landed on the student dashboard after
   * login, because the login form pushes a fixed default.
   *
   * The lookup only runs on the four home paths and inside /admin, so ordinary
   * navigation still costs no extra query.
   */
  const needsRole =
    (ROLE_HOMES as readonly string[]).includes(pathname) ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  if (user && needsRole) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    // A failed or missing lookup deliberately redirects nowhere. Guessing a
    // role here is how a bad read turns into a redirect loop, which is exactly
    // what 96c5e43 had to undo.
    const role = profile?.role ?? null;

    let target: string | null = null;

    if (role && isForeignHome(pathname, role)) {
      // Standing on another role's landing page — go to your own.
      target = roleHome(role);
    } else if (
      role &&
      role !== "admin" &&
      (pathname === "/admin" || pathname.startsWith("/admin/"))
    ) {
      // Anything under /admin is the platform owner's alone.
      target = roleHome(role);
    }

    if (target && target !== pathname) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      url.search = "";
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }
  }

  return response;
}
