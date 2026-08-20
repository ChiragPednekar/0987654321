import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  case_id: z.string().uuid(),
  type: z.enum(["wrong_rubric", "ambiguous_prompt", "data_error", "other"]),
  description: z.string().trim().min(10).max(1000),
});

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
    return NextResponse.json(
      { error: "Add a bit more detail (10-1000 characters)." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("case_reports").insert({
    user_id: user.id,
    case_id: body.case_id,
    type: body.type,
    description: body.description,
  });

  if (error) {
    return NextResponse.json(
      { error: "Could not submit report" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
