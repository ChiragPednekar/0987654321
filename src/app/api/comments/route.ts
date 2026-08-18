import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  case_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  body: z.string().trim().min(2).max(5_000),
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
    return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      case_id: body.case_id,
      user_id: user.id,
      parent_id: body.parent_id ?? null,
      body: body.body,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not post comment" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
