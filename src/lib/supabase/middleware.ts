import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";
import { ROLE_HOMES, mustRedirectFromHome, roleHome } from "@/lib/role-home";
import { SESSION_COOKIE_OPTIONS } from "./cookie-options";

/**
 * Anyone can sign up (071), but the app is still behind a session: the list
 * below is the complete set of paths that may be seen without an account.
 * Anything else needs a signed-in, live account — and, except for
 * OPEN_WITHOUT_PLAN, a plan or a campus licence (072).
 *
 * /certificate/<code> is public on purpose — it is the verification page an
 * employer opens from a CV.
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
  "/certificate",
];

/**
 * What a signed-in account without a plan or licence may still open: the ways
 * to pay, its own account, and the expert pages an interviewer who is not a
 * student needs. Everything else redirects to /upgrade (072).
 */
const OPEN_WITHOUT_PLAN = [
  "/upgrade",
  "/pricing",
  "/purchases",
  "/settings",
  "/profile",
  "/notifications",
  "/experts/apply",
  "/experts/dashboard",
  "/api/billing",
  "/api/settings",
  "/api/notifications",
  "/api/experts/apply",
  "/api/experts/me",
  "/api/experts/bookings",
];

function isOpenWithoutPlan(pathname: string): boolean {
  return OPEN_WITHOUT_PLAN.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function redirectTo(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
  params: Record<string, string> = {},
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirectResponse;
}

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
      cookieOptions: SESSION_COOKIE_OPTIONS,
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

  /**
   * API routes answer for themselves and must never be redirected.
   *
   * Closing the platform initially bounced every non-public path to /login,
   * which included /api. That broke the cron endpoints outright: Vercel Cron
   * carries no session cookie, so both a correct and a forged CRON_SECRET got
   * a 307 to /login and the route that checks the secret was never reached.
   * The leaderboard refresh and the daily quiz would have stopped silently.
   *
   * It also changed the contract for every other route — an HTML redirect
   * where a caller expects JSON, and a 200 where it expects 401.
   */
  const isApi = pathname.startsWith("/api/");

  // Unauthenticated user trying to reach a protected area -> bounce to /login
  if (!user && isProtected && !isApi) {
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
   * Access gate: a live account, and a plan or licence (072).
   *
   * RLS already returns no content to an account without either, but almost
   * every page under (app) renders through the service-role client, which
   * bypasses RLS by design. So for those pages this check is the only thing
   * standing between an unpaid account and the product.
   *
   * Costs one RPC (app_gate) on non-public paths. That is the price of the
   * service-role rendering; trusting the JWT instead would mean trusting a
   * token issued before a plan ran out.
   */
  if (user && isProtected) {
    const { data: gate } = await supabase.rpc("app_gate");
    const row = Array.isArray(gate) ? gate[0] : gate;

    // A deactivated account: nothing at all. Only an explicit false counts —
    // a failed lookup must not send every paying student to a "closed" page.
    if (row?.live === false) {
      // An API caller gets a status it can act on, not a login page. This is
      // the gate that matters for the routes reading through the service-role
      // client, where RLS withholds nothing.
      if (isApi) {
        return NextResponse.json(
          { error: "This account does not have access." },
          { status: 403 },
        );
      }
      return redirectTo(request, response, "/no-access");
    }

    /**
     * The paywall (072). Without a plan or a live campus licence, the only
     * things an account may open are the ways to pay and its own account.
     *
     * This FAILS CLOSED: a lookup that errors is treated as unpaid. Almost
     * every page renders through the service-role client, so RLS cannot hold
     * the line behind a failed check. A paying student who hits a hiccup lands
     * on /upgrade, which reads their plan through the service role and shows
     * it — one click back.
     */
    if (row?.entitled !== true && !isOpenWithoutPlan(pathname)) {
      if (isApi) {
        return NextResponse.json(
          {
            error: "CaseCode needs a plan or your college's licence. Upgrade to continue.",
            upgrade: true,
          },
          { status: 402 },
        );
      }
      return redirectTo(request, response, "/upgrade", { from: pathname });
    }
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
