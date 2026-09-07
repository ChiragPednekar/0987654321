import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const joinSchema = z.object({
  code: z.string().trim().min(4).max(20),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: z.infer<typeof joinSchema>;
  try {
    body = joinSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid join code" }, { status: 400 });
  }

  let code = body.code.toUpperCase().replace(/\s+/g, "");
  if (!code.startsWith("GRP-") && !code.includes("-")) {
    code = `GRP-${code}`;
  }
  const admin = createAdminClient();

  // Search for the group matching this code in description
  const { data: groups, error: searchError } = await admin
    .from("groups")
    .select("id, slug, name, description")
    .ilike("description", `%[join_code:${code}]%`)
    .limit(1);

  if (searchError) {
    return NextResponse.json({ error: "Failed to query group" }, { status: 500 });
  }

  const group = groups?.[0];

  if (!group) {
    return NextResponse.json(
      { error: "Invalid group code. Please check the code and try again." },
      { status: 404 },
    );
  }

  // Join the group
  const { error: memberError } = await admin
    .from("group_members")
    .upsert({ group_id: group.id, user_id: user.id }, { onConflict: "group_id,user_id" });

  if (memberError) {
    return NextResponse.json({ error: "Could not join the group." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    slug: group.slug,
    name: group.name,
  });
}
