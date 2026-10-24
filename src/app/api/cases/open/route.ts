import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";

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

  // Ordinary case pages are learning sessions. Reloading or taking a break
  // must never create an exam strike. Formal contests use their own entry clock.
  const { error: stampError } = await admin.from("solve_attempts").upsert({
    user_id:user.id,case_id:caseData.id,started_at:new Date().toISOString(),
  },{onConflict:"user_id,case_id"});
  if(stampError) return NextResponse.json({error:"Could not start practice."},{status:500});
  return NextResponse.json({scenario:caseData.scenario,instructions:caseData.instructions,supporting_data:caseData.supporting_data,attachments:caseData.attachments,expected_framework:caseData.expected_framework});

}
