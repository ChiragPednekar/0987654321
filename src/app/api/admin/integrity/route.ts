import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthzError, requireAdminActor } from "@/lib/authz";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  submission_id: z.string().uuid(),
  note: z.string().max(500).optional(),
  /** Lift the automatic suspension this finding contributed to. */
  reinstate: z.boolean().default(false),
});

/**
 * Clears an integrity finding.
 *
 * The counterpart to the automatic penalty, and the reason the automatic
 * penalty is defensible at all. Stylometric AI detection and browser telemetry
 * both produce false positives, and a system that can accuse without a route to
 * be overruled is not a system a college should be asked to trust.
 *
 * The row is updated, never deleted: `cleared_at`, who cleared it and why stay
 * on the record. `integrity_strikes()` ignores cleared rows, so clearing one
 * immediately restores the student's standing with no counter to remember
 * separately.
 *
 * Reinstating is a separate flag rather than automatic. A student may have
 * three findings and deserve only one of them cleared, and quietly reopening a
 * suspended account as a side effect of correcting one submission would hide a
 * decision that ought to be deliberate.
 */
export async function POST(request: NextRequest) {
  let actor;
  try {
    actor = await requireAdminActor();
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: finding, error } = await admin
    .from("submission_integrity")
    .update({
      cleared_at: new Date().toISOString(),
      cleared_by: actor.id,
      cleared_note: body.note ?? null,
    })
    .eq("submission_id", body.submission_id)
    .is("cleared_at", null)
    .select("user_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!finding) {
    return NextResponse.json(
      { error: "No open finding for that submission." },
      { status: 404 },
    );
  }

  // Note what is deliberately NOT done here: the score is left alone. Rewriting
  // a stored mark after the fact would desynchronise the leaderboard, the
  // classroom gradebook and any export a teacher has already taken. Clearing
  // the finding stops it counting towards a suspension and marks the record
  // corrected; re-grading is the student's next attempt.
  if (body.reinstate) {
    await admin
      .from("users")
      .update({ deactivated_at: null, deactivated_reason: null })
      .eq("id", finding.user_id);
  }

  return NextResponse.json({ ok: true });
}
