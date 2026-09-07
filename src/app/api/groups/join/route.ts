import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseGroupJoinCode } from "@/lib/group-codes";

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

  const code = normaliseGroupJoinCode(body.code);
  const admin = createAdminClient();

  /**
   * Exact match on the column, not a substring search of free text.
   *
   * The previous version matched `ilike '%[join_code:…]%'` against the
   * description. Nothing enforced uniqueness there, so a duplicate code
   * admitted you to whichever group came back first, and any description that
   * merely contained the pattern matched. `join_code` is unique where present.
   *
   * The legacy `GRP-` prefix is stripped by normalise(), so a code handed out
   * under the old scheme still works.
   */
  const { data: groups, error: searchError } = await admin
    .from("groups")
    .select("id, slug, name, is_private")
    .eq("join_code", code)
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
