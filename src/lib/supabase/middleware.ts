import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";
import { ROLE_HOMES, mustRedirectFromHome, roleHome } from "@/lib/role-home";

/**
 * The platform is invite-only: everything is closed except the way in.
 *
 * This used to be the other way round — a short PROTECTED_PREFIXES list, with
 * the library, paths, contests and leaderboard left public as the top of the
 * funnel. 20250101000060 ended that, so the list below is now the complete set
 * of paths that may be seen without an account.
 *
 * Anything not listed here needs a session AND an address on access_allowlist.
 */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/no-access",
  "/auth",
  "/terms",
  "/privacy",
  "/pricing",
  "/how-grading-works",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );
}

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

  const isProtected = !isPublic(pathname);

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
   * Invite-only gate.
   *
   * RLS already returns nothing to an account that is not on the list, but
   * almost every page under (app) renders through the service-role client,
   * which bypasses RLS by design. So for those pages this check is the only
   * thing standing between a de-listed account and the questions.
   *
   * Costs one RPC on non-public paths. That is the price of the service-role
   * rendering; shrinking it by trusting the JWT would mean trusting a token
   * issued before the address was removed.
   */
  if (user && isProtected) {
    const { data: allowed } = await supabase.rpc("has_access", {
      p_user: user.id,
    });

    if (allowed === false) {
      const url = request.nextUrl.clone();
      url.pathname = "/no-access";
      url.search = "";
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }
    // A null/errored result deliberately does NOT redirect: a failed lookup
    // must not lock out the whole platform. RLS still withholds the rows.
  }

  /**
   * Role routing.
   *
   * The three dashboards are separate entities, so each account LANDS on its
   * own after login — the login form resolves that, and roleHome() is the one
   * answer both use.
   *
   * The second question is where a role may BE: exactly its own home, and
   * nowhere else. A teacher opening /dashboard goes back to /teacher, the owner
   * opening either goes back to /admin. Privilege deliberately does not flow
   * downward here — an owner who wants the teacher product signs in as the
   * teacher, which is what the separate login is for.
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

    if (role && mustRedirectFromHome(pathname, role)) {
      // Standing on a dashboard this role may not open — go to your own.
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
