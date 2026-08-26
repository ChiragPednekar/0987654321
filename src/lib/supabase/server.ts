import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";
import { createAdminClientOrNull } from "@/lib/supabase/admin";

/**
 * Server client for RSCs, route handlers and server actions.
 * Reads the session from cookies and stays subject to RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/** The signed-in user's profile row, or null. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  // Every column of public.users that a signed-in user is granted to read.
  // `email` is deliberately absent — 20250101000015_read_privileges.sql revokes
  // it from anon and authenticated, because the row policy on users is
  // `using (true)`, so a column readable there is readable for *everyone's*
  // row, not just your own. Selecting it here would fail on privileges.
  // Kept inline as one literal: supabase-js infers the row type from it.
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select(
      "id, full_name, avatar_url, university, career_goal, role, ce, level, total_score, cases_solved, cases_attempted, current_streak, longest_streak, last_solved_on, open_to_opportunities, plan, created_at, updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    return { ...profile, email: user.email ?? "" };
  }

  /**
   * A *failed* read is not a missing profile, and the difference matters.
   *
   * Everything below treats "no row" as "this account has no profile yet" and
   * synthesises one — which defaults `role` to "student". When the select
   * itself errors, that fallback silently demotes every signed-in user: the
   * platform owner is handed a student's navigation and a dashboard of zeros,
   * with nothing anywhere saying why. That is exactly what a stray
   * `deactivated_at` in this column list did in production.
   *
   * The fallback still runs, because being logged out is worse. But it says so.
   */
  if (profileError) {
    console.error("[auth] profile read failed — falling back to a synthetic profile", {
      user_id: user.id,
      code: profileError.code,
      message: profileError.message,
    });
  }

  // If the public.users record is missing (e.g. trigger didn't run or table was rebuilt),
  // self-heal by creating the profile using the admin client.
  const fullName =
    (user.user_metadata?.full_name as string) ??
    (user.user_metadata?.name as string) ??
    user.email?.split("@")[0] ??
    "User";
  const avatarUrl = (user.user_metadata?.avatar_url as string) ?? null;

  const admin = createAdminClientOrNull();
  if (admin) {
    try {
      await admin.from("users").upsert(
        {
          id: user.id,
          email: user.email ?? "",
          full_name: fullName,
          avatar_url: avatarUrl,
        },
        { onConflict: "id" },
      );
      const { data: createdProfile } = await admin
        .from("users")
        .select(
          "id, full_name, avatar_url, university, career_goal, role, ce, level, total_score, cases_solved, cases_attempted, current_streak, longest_streak, last_solved_on, open_to_opportunities, plan, created_at, updated_at",
        )
        .eq("id", user.id)
        .maybeSingle();
      if (createdProfile) {
        return { ...createdProfile, email: user.email ?? "" };
      }
    } catch (e) {
      console.error("[auth] failed to upsert missing user profile", e);
    }
  }

  // Safe fallback profile so authenticated users never get stuck in a redirect loop
  return {
    id: user.id,
    email: user.email ?? "",
    full_name: fullName,
    avatar_url: avatarUrl,
    university: null,
    career_goal: null,
    role: ((user.user_metadata?.role as string) ?? "student") as Database["public"]["Tables"]["users"]["Row"]["role"],
    ce: 0,
    level: 1,
    total_score: 0,
    cases_solved: 0,
    cases_attempted: 0,
    current_streak: 0,
    longest_streak: 0,
    last_solved_on: null,
    open_to_opportunities: false,
    plan: "free" as const,
    deactivated_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Throws unless the caller is a signed-in admin. Use to guard admin routes. */
export async function requireAdmin() {
  const profile = await getCurrentUser();
  if (!profile || profile.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return profile;
}
