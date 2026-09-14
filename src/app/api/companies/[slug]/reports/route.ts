import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INTERVIEW_ROUNDS, REPORT_LIMITS } from "@/lib/companies";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  role: z.string().trim().min(2).max(REPORT_LIMITS.maxRole),
  round: z.enum(INTERVIEW_ROUNDS),
  year: z.number().int().min(REPORT_LIMITS.earliestYear).max(new Date().getUTCFullYear()),
  question: z.string().trim().min(REPORT_LIMITS.minQuestion).max(REPORT_LIMITS.maxQuestion),
});

/**
 * Reports a question a student was asked.
 *
 * Open to any signed-in student, licensed or not: it costs nothing, and the
 * people who have just sat an interview are exactly the ones worth hearing
 * from. Every report waits for an admin, so openness cannot put anything on a
 * company page by itself. A daily cap and a duplicate check keep the queue
 * reviewable.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      {
        error: `Give the role, the round, the year and the question (at least ${REPORT_LIMITS.minQuestion} characters).`,
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("id")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin
    .from("company_question_reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= REPORT_LIMITS.perDay) {
    return NextResponse.json(
      { error: `You can report up to ${REPORT_LIMITS.perDay} questions a day. Thank you — try again tomorrow.` },
      { status: 429 },
    );
  }

  const normalised = body.question.replace(/\s+/g, " ").toLowerCase();
  const { data: mine } = await admin
    .from("company_question_reports")
    .select("question")
    .eq("user_id", user.id)
    .eq("company_id", company.id);
  if ((mine ?? []).some((r) => r.question.replace(/\s+/g, " ").toLowerCase() === normalised)) {
    return NextResponse.json({ error: "You have already reported this question." }, { status: 409 });
  }

  const { data: report, error } = await admin
    .from("company_question_reports")
    .insert({
      company_id: company.id,
      user_id: user.id,
      role: body.role,
      round: body.round,
      year: body.year,
      question: body.question,
    })
    .select("id, role, round, year, question, status, created_at")
    .single();

  if (error || !report) {
    console.error("[companies] could not store report", error);
    return NextResponse.json({ error: "Could not save your report." }, { status: 500 });
  }

  return NextResponse.json({ report }, { status: 201 });
}
