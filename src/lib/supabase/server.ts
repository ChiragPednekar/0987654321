import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

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
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Every column of public.users that a signed-in user is granted to read.
  // `email` is deliberately absent — 20250101000015_read_privileges.sql revokes
  // it from anon and authenticated, because the row policy on users is
  // `using (true)`, so a column readable there is readable for *everyone's*
  // row, not just your own. Selecting it here would fail on privileges.
  // Kept inline as one literal: supabase-js infers the row type from it.
  const { data: profile } = await supabase
    .from("users")
    .select(
      "id, full_name, avatar_url, university, career_goal, role, xp, level, total_score, cases_solved, cases_attempted, current_streak, longest_streak, last_solved_on, created_at, updated_at",
    )
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  // The session already carries the address, so callers that show "you are
  // signed in as …" keep working without the column being world-readable.
  return { ...profile, email: user.email ?? "" };
}

/** Throws unless the caller is a signed-in admin. Use to guard admin routes. */
export async function requireAdmin() {
  const profile = await getCurrentUser();
  if (!profile || profile.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return profile;
}
