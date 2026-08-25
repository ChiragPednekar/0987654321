import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  audit,
  authzResponse,
  requireBatchTeacher,
  requireTeacherActor,
  batchesTaughtBy,
} from "@/lib/authz";
import { slugify } from "@/lib/utils";
import type { Difficulty, Domain } from "@/lib/types/database";

const rubricCriterion = z.object({
  key: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  weight: z.number().int().min(1).max(100),
  descriptor: z.string().trim().max(600).optional(),
});

const bodySchema = z.object({
  title: z.string().trim().min(4).max(200),
  domain: z.enum([
    "finance", "consulting", "product_management",
    "marketing", "strategy", "operations",
  ]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  format: z.enum(["full_case", "framework", "debug"]),
  scenario: z.string().trim().min(50).max(20_000),
  instructions: z.string().trim().min(10).max(5_000),
  expected_framework: z.string().trim().max(4_000).optional().nullable(),
  model_answer: z.string().trim().max(20_000).optional().nullable(),
  /** Which batch owns it. The question is visible only inside that batch. */
  classroom_id: z.string().uuid(),
  hints: z
    .array(z.object({
      body: z.string().trim().min(4).max(2_000),
      penalty_pct: z.number().int().min(0).max(50).default(10),
    }))
    .max(5)
    .default([]),
  rubric: z.array(rubricCriterion).min(1).max(8),
  is_published: z.boolean().default(false),
});

/**
 * Creates a teacher-authored question (spec §12).
 *
 * Written into `cases` rather than a parallel table: an assignment must be able
 * to point at either a platform case or a teacher's, and a second table would
 * mean two of every query and two grading paths. Ownership separates them —
 * `visibility = 'private'` plus `owner_classroom_id` scope it to one batch, so
 * it never appears in the public library.
 */
export async function POST(request: NextRequest) {
  let actor;
  try {
    actor = await requireTeacherActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? `${error.issues[0]?.path.join(".")}: ${error.issues[0]?.message}`
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // The batch id came from the client, so prove they teach it.
  try {
    await requireBatchTeacher(body.classroom_id);
  } catch (error) {
    const { body: b, status } = authzResponse(error);
    return NextResponse.json(b, { status });
  }

  // Rubric weights are the denominator of every score on this question, so a
  // duplicate key would silently drop a criterion.
  const keys = body.rubric.map((c) => c.key);
  if (new Set(keys).size !== keys.length) {
    return NextResponse.json(
      { error: "Each rubric criterion needs a distinct key." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const base = `t-${slugify(body.title).slice(0, 40)}`;
  let slug = base;
  for (let n = 2; n <= 30; n += 1) {
    const { data: taken } = await admin
      .from("cases").select("id").eq("slug", slug).maybeSingle();
    if (!taken) break;
    slug = `${base}-${n}`;
  }

  const { data: created, error } = await admin
    .from("cases")
    .insert({
      slug,
      title: body.title,
      domain: body.domain,
      difficulty: body.difficulty,
      format: body.format,
      scenario: body.scenario,
      instructions: body.instructions,
      expected_framework: body.expected_framework ?? null,
      model_answer: body.model_answer ?? null,
      supporting_data: {},
      tags: [],
      is_published: body.is_published,
      created_by: actor.id,
      visibility: "private",
      owner_classroom_id: body.classroom_id,
    })
    .select("id, slug")
    .single();

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create the question." },
      { status: 500 },
    );
  }

  // A rubric is not optional. Grading clamps each criterion to its weight and
  // recomputes the total, so without one there is nothing to grade against.
  const criteria = Object.fromEntries(body.rubric.map((c) => [c.key, c.weight]));
  const descriptors = Object.fromEntries(
    body.rubric.filter((c) => c.descriptor).map((c) => [c.key, c.descriptor!]),
  );
  const maxScore = body.rubric.reduce((a, c) => a + c.weight, 0);

  const { error: rubricError } = await admin.from("rubrics").insert({
    case_id: created.id,
    criteria,
    descriptors,
    max_score: maxScore,
    pass_score: 60,
  });

  if (rubricError) {
    // A case with no rubric can never be graded; roll it back rather than
    // leaving a question that fails the first time a student submits.
    await admin.from("cases").delete().eq("id", created.id);
    return NextResponse.json(
      { error: "Could not save the rubric." },
      { status: 500 },
    );
  }

  if (body.hints.length > 0) {
    await admin.from("case_hints").insert(
      body.hints.map((h, i) => ({
        case_id: created.id,
        step: i + 1,
        body: h.body,
        penalty_pct: h.penalty_pct,
      })),
    );
  }

  await audit(actor, "question.create", "cases", created.id, {
    title: body.title, classroom_id: body.classroom_id,
  });

  return NextResponse.json(
    { id: created.id, slug: created.slug, max_score: maxScore },
    { status: 201 },
  );
}

/** The teacher's own question bank. */
export async function GET(request: NextRequest) {
  let actor;
  try {
    actor = await requireTeacherActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  const { searchParams } = new URL(request.url);
  const admin = createAdminClient();
  const mine = await batchesTaughtBy(actor.id);

  let query = admin
    .from("cases")
    .select("id, slug, title, domain, difficulty, format, is_published, created_at, owner_classroom_id")
    .eq("created_by", actor.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(100, Number(searchParams.get("limit") ?? 50)));

  const domain = searchParams.get("domain");
  if (domain) query = query.eq("domain", domain as Domain);
  const difficulty = searchParams.get("difficulty");
  if (difficulty) query = query.eq("difficulty", difficulty as Difficulty);
  const search = searchParams.get("q");
  if (search) query = query.ilike("title", `%${search}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ questions: data ?? [], batches: mine });
}
