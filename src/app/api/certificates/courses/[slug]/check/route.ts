import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCertCourse } from "@/lib/cert-courses";
import { gradeCheck, moduleCheck } from "@/lib/cert-course-checks";
import { getCourseProgress } from "@/lib/course-progress";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  moduleId: z.string().min(1).max(80),
  answers: z.array(z.number().int().min(0).max(10)).max(20),
});

/**
 * Grades a module's knowledge check and records the result.
 *
 * Retakes are allowed — this is a learning check, not the exam — and a pass,
 * once earned, is never taken away by a later attempt. No plan is needed: the
 * course leads to the certificate exam, which is sold on its own.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid answers." }, { status: 400 });

  const course = getCertCourse(slug);
  const questions = moduleCheck(parsed.data.moduleId);
  if (!course || !questions || !course.modules.some((m) => m.id === parsed.data.moduleId)) {
    return NextResponse.json({ error: "Module not found." }, { status: 404 });
  }
  if (parsed.data.answers.length !== questions.length) {
    return NextResponse.json({ error: "Answer every question." }, { status: 400 });
  }

  const graded = gradeCheck(parsed.data.moduleId, parsed.data.answers);
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("course_progress")
    .select("passed, attempts, passed_at")
    .eq("user_id", user.id)
    .eq("exam_slug", slug)
    .eq("module_id", parsed.data.moduleId)
    .maybeSingle();

  const now = new Date().toISOString();
  const keepPass = existing?.passed === true;
  await admin.from("course_progress").upsert(
    {
      user_id: user.id,
      exam_slug: slug,
      module_id: parsed.data.moduleId,
      correct: graded.correct,
      total: graded.total,
      passed: keepPass || graded.passed,
      attempts: (existing?.attempts ?? 0) + 1,
      passed_at: keepPass ? existing?.passed_at : graded.passed ? now : null,
      updated_at: now,
    },
    { onConflict: "user_id,exam_slug,module_id" },
  );

  const progress = await getCourseProgress(admin, user.id, slug);
  return NextResponse.json({ ...graded, progress });
}
