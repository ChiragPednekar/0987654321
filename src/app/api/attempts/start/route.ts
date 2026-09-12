import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ case_id: z.string().uuid() });

/**
 * Stamps when this student opened this case, server-side.
 *
 * The editor already reports `time_spent_seconds`, but that number comes from
 * the client and is therefore the first thing a cheat would set to something
 * flattering. This is the copy the integrity check reads.
 *
 * ON CONFLICT DO NOTHING, deliberately. The alternative — refreshing the stamp
 * every time the page loads — would mean a student who reloaded just before
 * submitting looked like they produced 2,000 characters in four seconds, and
 * would be marked down for a browser refresh. Keeping the earliest start makes
 * the clock lenient rather than wrong: it can be padded by opening a case and
 * walking away, which is a far cheaper failure than falsely accusing someone.
 * The paste and typing signals are the primary detector; this is a backstop.
 *
 * The row is deleted when the submission consumes it, so the next genuine
 * attempt starts a fresh clock.
 */
export async function POST(request: NextRequest) {
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
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  // No entitlement check here on purpose: this writes one timestamp and reveals
  // nothing. Gating it would only tell an unlicensed account that the case
  // exists, which the public library already does.
  const { error } = await admin
    .from("solve_attempts")
    .insert({ user_id: user.id, case_id: body.case_id })
    .select()
    .maybeSingle();

  // 23505 is the unique violation from an attempt already in progress, which
  // is the expected path on every reload and not a failure.
  if (error && error.code !== "23505") {
    console.error("[attempts] stamp failed", error.message);
  }

  return NextResponse.json({ ok: true });
}
