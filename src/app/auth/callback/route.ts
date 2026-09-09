import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/role-home";

/**
 * OAuth + email-link landing point. Supabase redirects here with a `code`
 * which we exchange for a session cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=Missing+auth+code`);
  }

  const supabase = await createClient();
  const { data: session, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  // Only ever redirect to a path on this origin — never to an attacker-supplied
  // absolute URL.
  let safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  /**
   * Land on the dashboard this account owns.
   *
   * `next` defaults to /dashboard, which is the student product — so a teacher
   * or the platform owner signing in with Google arrived on somebody else's
   * home and was bounced by the middleware a moment later. The email form
   * already resolved the role before redirecting; this is the same fix for the
   * OAuth path, which matters more because the owner accounts are Gmail
   * addresses and will use it every time.
   *
   * A real `next` is still honoured: someone who clicked a link, got sent to
   * /login and signed in should end up where they were going.
   */
  if (safeNext === "/dashboard" && session?.user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    // A failed read leaves /dashboard, which the middleware corrects. It must
    // not become an error — signing in has already succeeded by this point.
    safeNext = roleHome(profile?.role ?? null);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
