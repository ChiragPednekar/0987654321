import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  body: z.string().trim().min(2).max(5_000),
});

type Params = { params: Promise<{ id: string }> };

/** Post to a group (spec §10). Members only, private or not. */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request")
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  // Reading a public group does not entitle you to post in it.
  const { data: membership } = await admin
    .from("group_members")
    .select("user_id")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "Join the group before posting." },
      { status: 403 },
    );
  }

  const { data: post, error } = await admin
    .from("group_posts")
    .insert({ group_id: id, user_id: user.id, body: parsed.body })
    .select("id")
    .single();

  if (error || !post) {
    return NextResponse.json({ error: "Could not post." }, { status: 500 });
  }

  return NextResponse.json({ id: post.id }, { status: 201 });
}
