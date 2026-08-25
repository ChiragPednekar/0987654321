import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  case_id: z.string().uuid(),
  due_at: z.string().datetime().optional().nullable(),
  note: z.string().trim().max(500).optional(),
  // Null means practice only — the assignment carries no marks.
  max_marks: z.number().positive().max(1000).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

/** Assign a case to a classroom (spec §11). Teachers only. */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
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
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request")
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  // The service role bypasses RLS, so the teacher check has to be explicit
  // here — being a member is not enough to set homework.
  const { data: membership } = await admin
    .from("classroom_members")
    .select("role")
    .eq("classroom_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "teacher") {
    return NextResponse.json(
      { error: "Only teachers can set assignments." },
      { status: 403 },
    );
  }

  const { error } = await admin.from("classroom_assignments").upsert(
    {
      classroom_id: id,
      case_id: body.case_id,
      due_at: body.due_at ?? null,
      note: body.note ?? null,
      max_marks: body.max_marks ?? null,
    },
    { onConflict: "classroom_id,case_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
