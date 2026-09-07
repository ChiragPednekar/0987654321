import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  show_on_leaderboard: z.boolean().optional(),
  share_history_with_cohort: z.boolean().optional(),
  show_college_affiliation: z.boolean().optional(),
});

/**
 * Saves a user's privacy preferences.
 *
 * These used to live in localStorage. The panel promised control over "how your
 * rank, university, and performance appear to peers and recruiters" and
 * answered "Privacy preferences updated." — while the server never heard about
 * it, so switching off "Show on leaderboard" left the user on the leaderboard
 * for everyone, and the choice did not survive changing browser.
 *
 * Written with the service role after proving the caller owns the row:
 * 20250101000004 restricts which columns `authenticated` may update, and these
 * are deliberately not among them, so a user cannot flip somebody else's
 * visibility with the anon key.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request")
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("users").update(body).eq("id", user.id);

  if (error) {
    // The columns arrive with 20250101000028; a deployment can be ahead of its
    // database. Say which migration rather than surfacing a raw Postgres code.
    if (
      error.code === "42703" ||
      error.code === "PGRST204" ||
      /show_on_leaderboard|share_history_with_cohort|show_college_affiliation/.test(
        error.message ?? "",
      )
    ) {
      console.error("[settings] privacy columns missing", error.message);
      return NextResponse.json(
        {
          error:
            "Privacy settings are not available yet — this database is missing the preference columns. Apply migration 20250101000028_privacy_preferences.sql.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /**
   * Leaving the leaderboard should take effect now, not at the next cron.
   *
   * Someone switching this off is asking to stop being visible; "in up to a
   * day" is not an answer to that. Rebuilding is cheap at this size and the
   * function is idempotent.
   */
  if (body.show_on_leaderboard !== undefined) {
    const { error: refreshError } = await admin.rpc("refresh_leaderboards");
    if (refreshError) {
      console.error("[settings] leaderboard refresh failed", refreshError.message);
    }
  }

  return NextResponse.json({ ok: true, ...body });
}
