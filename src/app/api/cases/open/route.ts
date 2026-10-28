import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { lockoutResponse, recordLockout, lockMessage } from "@/lib/exam-lockouts";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ slug: z.string().min(1).max(120) });

/**
 * Hands over the case scenario and instructions only after the student has armed
 * exam mode and started the test, mirroring /api/sql/open and /api/excel/open.
 *
 * This prevents students from viewing the question, framework, or supporting
 * data in page source before proctoring has begun.
 *
 * In addition, it tracks in-progress attempts: if a student started a test on this
 * question and abandoned it (force-quitted, closed the tab, cut internet) without
 * submitting, returning to this question treats the unsubmitted exit as an
 * integrity violation and records a strike lockout.
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

  const locked = await lockoutResponse(user.id, `/cases/${body.slug}`);
  if (locked) return locked;

  const admin = createAdminClient();

  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  const { data: caseData } = await admin
    .from("cases")
    .select(
      "id, slug, scenario, instructions, supporting_data, attachments, expected_framework, is_published, is_pro",
    )
    .eq("slug", body.slug)
    .maybeSingle();

  if (!caseData || !caseData.is_published) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  // Check for an abandoned in-progress attempt (Gap 4: dodged flag prevention)
  const { data: existingAttempt } = await admin
    .from("solve_attempts")
    .select("started_at")
    .eq("user_id", user.id)
    .eq("case_id", caseData.id)
    .maybeSingle();

  if (existingAttempt?.started_at) {
    const elapsedSinceStart =
      (Date.now() - new Date(existingAttempt.started_at).getTime()) / 1000;

    // If an attempt was started more than 45 seconds ago and never completed/submitted,
    // it was abandoned. Treat as unsubmitted exit violation -> record strike lockout!
    if (elapsedSinceStart > 45) {
      await admin
        .from("solve_attempts")
        .delete()
        .eq("user_id", user.id)
        .eq("case_id", caseData.id);

      const lock = await recordLockout(admin, {
        userId: user.id,
        path: `/cases/${caseData.slug}`,
        reason: "no_face",
        signals: {
          violation: "abandoned_test",
          message: "A test on this question was previously started and abandoned without submitting.",
          elapsedSinceStart,
        },
      });

      return NextResponse.json(
        {
          error: lock
            ? lockMessage(lock)
            : "Test was started and abandoned without submitting. Question is locked.",
          lock,
        },
        { status: 403 },
      );
    }
  }

  // Stamp server start clock
  await admin
    .from("solve_attempts")
    .upsert(
      {
        user_id: user.id,
        case_id: caseData.id,
        started_at: new Date().toISOString(),
      },
      { onConflict: "user_id,case_id" },
    );

  return NextResponse.json({
    scenario: caseData.scenario,
    instructions: caseData.instructions,
    supporting_data: caseData.supporting_data,
    attachments: caseData.attachments,
    expected_framework: caseData.expected_framework,
  });
}
