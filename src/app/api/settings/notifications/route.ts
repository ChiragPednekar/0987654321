import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  notify_assignments: z.boolean(),
});

/**
 * Saves the one notification preference the product can actually honour.
 *
 * This used to be four toggles in localStorage that each answered
 * "Notification preferences updated." while the server never heard about them.
 * Three of the four described delivery the codebase has no mechanism for —
 * there is no mail provider and no scheduled reminder job — and the fourth was
 * ignored by all six routes that create notifications.
 *
 * Written with the service role after proving the caller owns the row:
 * 20250101000004 restricts which columns `authenticated` may update, and this
 * is deliberately not one of them, so nobody can silence someone else.
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

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ notify_assignments: body.notify_assignments })
    .eq("id", user.id);

  if (error) {
    // The column arrives with 20250101000030; a deployment can be ahead of its
    // database. Say which migration rather than surfacing a raw Postgres code.
    if (
      error.code === "42703" ||
      error.code === "PGRST204" ||
      /notify_assignments/.test(error.message ?? "")
    ) {
      console.error("[settings] notification column missing", error.message);
      return NextResponse.json(
        {
          error:
            "Notification settings are not available yet — this database is missing the preference column. Apply migration 20250101000030_notification_preferences.sql.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...body });
}
