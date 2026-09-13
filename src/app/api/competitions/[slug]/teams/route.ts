import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { generateGroupJoinCode } from "@/lib/group-codes";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ name: z.string().trim().min(2).max(60) });

/** Creates a team and makes the creator its lead. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Give the team a name." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  const { data: comp } = await admin
    .from("competitions")
    .select("id, closes_at, is_published")
    .eq("slug", slug)
    .maybeSingle();

  if (!comp || !comp.is_published) {
    return NextResponse.json({ error: "Competition not found." }, { status: 404 });
  }
  if (new Date(comp.closes_at) <= new Date()) {
    return NextResponse.json({ error: "This competition has closed." }, { status: 409 });
  }

  const { data: team, error } = await admin
    .from("competition_teams")
    .insert({
      competition_id: comp.id,
      name: body.name,
      join_code: generateGroupJoinCode(),
      created_by: user.id,
    })
    .select("id, join_code")
    .single();

  if (error || !team) {
    // 23505 is the (competition_id, name) unique key.
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A team with that name is already entered." },
        { status: 409 },
      );
    }
    console.error("[competition] team create failed", error?.message);
    return NextResponse.json({ error: "Could not create the team." }, { status: 500 });
  }

  const { error: memberError } = await admin.from("competition_members").insert({
    team_id: team.id,
    user_id: user.id,
    competition_id: comp.id,
    is_lead: true,
  });

  if (memberError) {
    // The creator is already in another team for this competition — the
    // (competition_id, user_id) unique key. Undo the team rather than leaving
    // an empty one nobody can join or delete.
    await admin.from("competition_teams").delete().eq("id", team.id);
    return NextResponse.json(
      { error: "You are already in a team for this competition." },
      { status: 409 },
    );
  }

  return NextResponse.json({ id: team.id, join_code: team.join_code }, { status: 201 });
}
