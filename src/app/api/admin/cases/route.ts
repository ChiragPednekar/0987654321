import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

const caseSchema = z.object({
  title: z.string().trim().min(5).max(200),
  domain: z.enum([
    "finance",
    "consulting",
    "product_management",
    "marketing",
    "strategy",
  ]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  category_id: z.string().uuid().nullable().optional(),
  company_track: z.string().max(80).nullable().optional(),
  estimated_minutes: z.number().int().min(5).max(360).default(30),
  scenario: z.string().trim().min(50),
  instructions: z.string().trim().min(10),
  supporting_data: z.record(z.string(), z.unknown()).default({}),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        type: z.string(),
        size: z.number().optional(),
      }),
    )
    .default([]),
  expected_framework: z.string().nullable().optional(),
  model_answer: z.string().nullable().optional(),
  is_pro: z.boolean().optional(),
  tags: z.array(z.string()).default([]),
  is_published: z.boolean().default(false),
  rubric: z.object({
    criteria: z
      .record(z.string(), z.number().int().min(1).max(100))
      .refine((value) => Object.keys(value).length > 0, {
        message: "A rubric needs at least one criterion",
      }),
    descriptors: z.record(z.string(), z.string()).default({}),
    pass_score: z.number().int().min(0).max(100).default(60),
  }),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof caseSchema>;
  try {
    body = caseSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : "Invalid case";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { rubric, ...caseFields } = body;
  const maxScore = Object.values(rubric.criteria).reduce((a, b) => a + b, 0);

  // Slugs must be unique; suffix on collision rather than failing the request.
  const base = slugify(caseFields.title);
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: clash } = await supabase
      .from("cases")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: created, error: caseError } = await supabase
    .from("cases")
    .insert({ ...caseFields, slug, created_by: user?.id ?? null })
    .select("id, slug")
    .single();

  if (caseError || !created) {
    return NextResponse.json(
      { error: caseError?.message ?? "Could not create case" },
      { status: 500 },
    );
  }

  const { error: rubricError } = await supabase.from("rubrics").insert({
    case_id: created.id,
    criteria: rubric.criteria,
    descriptors: rubric.descriptors,
    max_score: maxScore,
    pass_score: rubric.pass_score,
  });

  if (rubricError) {
    // Don't leave a case that can never be graded.
    await supabase.from("cases").delete().eq("id", created.id);
    return NextResponse.json({ error: rubricError.message }, { status: 500 });
  }

  return NextResponse.json(created, { status: 201 });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 50));

  const { data, error } = await supabase
    .from("cases")
    .select(
      "id, slug, title, domain, difficulty, is_published, total_submissions, avg_score, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cases: data });
}
