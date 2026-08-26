import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { audit, authzResponse, requireAdminActor } from "@/lib/authz";

const patchSchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  domain: z
    .enum([
      "finance",
      "consulting",
      "product_management",
      "marketing",
      "strategy",
      // See the note in ../route.ts — `operations` was missing here too.
      "operations",
    ])
    .optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  company_track: z.string().max(80).nullable().optional(),
  estimated_minutes: z.number().int().min(5).max(360).optional(),
  scenario: z.string().trim().min(50).optional(),
  instructions: z.string().trim().min(10).optional(),
  supporting_data: z.record(z.string(), z.unknown()).optional(),
  expected_framework: z.string().nullable().optional(),
  model_answer: z.string().nullable().optional(),
  is_pro: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  is_published: z.boolean().optional(),
  rubric: z
    .object({
      criteria: z.record(z.string(), z.number().int().min(1).max(100)),
      descriptors: z.record(z.string(), z.string()).optional(),
      pass_score: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
});

export async function PATCH(
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

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createClient();
  const { rubric, ...caseFields } = body;

  if (Object.keys(caseFields).length > 0) {
    const { error } = await supabase
      .from("cases")
      .update(caseFields)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (rubric) {
    const maxScore = Object.values(rubric.criteria).reduce((a, b) => a + b, 0);
    const { error } = await supabase
      .from("rubrics")
      .update({
        criteria: rubric.criteria,
        descriptors: rubric.descriptors ?? {},
        max_score: maxScore,
        ...(rubric.pass_score !== undefined
          ? { pass_score: rubric.pass_score }
          : {}),
      })
      .eq("case_id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Publishing state and rubric changes are the two edits that change what
  // students see and how they are scored, so both are named in the trail.
  await audit(
    actor,
    body.is_published === true
      ? "case.publish"
      : body.is_published === false
        ? "case.unpublish"
        : rubric
          ? "case.rubric_update"
          : "case.update",
    "cases",
    id,
    { fields: Object.keys(caseFields), rubric_changed: Boolean(rubric) },
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
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
  const supabase = await createClient();

  // Cases with history are unpublished rather than deleted — dropping them
  // would cascade away real submissions and scores.
  const { count } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("case_id", id);

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from("cases")
      .update({ is_published: false })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await audit(actor, "case.unpublish", "cases", id, {
      reason: "submissions exist",
      submissions: count,
    });

    return NextResponse.json({
      ok: true,
      action: "unpublished",
      reason: `${count} submissions exist, so the case was unpublished instead of deleted.`,
    });
  }

  const { error } = await supabase.from("cases").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await audit(actor, "case.delete", "cases", id, {});

  return NextResponse.json({ ok: true, action: "deleted" });
}
