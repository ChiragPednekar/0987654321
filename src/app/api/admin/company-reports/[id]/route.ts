import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireAdminActor } from "@/lib/authz";
import { INTERVIEW_ROUNDS, REPORT_LIMITS } from "@/lib/companies";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(300).optional(),
  /**
   * Light edits before approving — a typo, a stray name. The reporter's words
   * are otherwise kept; an admin should reject rather than rewrite a question
   * into something the student was not asked.
   */
  question: z.string().trim().min(REPORT_LIMITS.minQuestion).max(REPORT_LIMITS.maxQuestion).optional(),
  round: z.enum(INTERVIEW_ROUNDS).optional(),
});

/** Approves or rejects a reported interview question. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let actor;
  try {
    actor = await requireAdminActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("company_question_reports")
    .update({
      status: body.status,
      review_note: body.note ?? null,
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      ...(body.question ? { question: body.question } : {}),
      ...(body.round ? { round: body.round } : {}),
    })
    .eq("id", id)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  void audit(actor, `company_report.${body.status}`, "company_question_reports", id, {
    edited: Boolean(body.question || body.round),
  });
  return NextResponse.json({ ok: true });
}
