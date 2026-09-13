import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { normaliseGroupJoinCode } from "@/lib/group-codes";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ join_code: z.string().trim().min(4).max(16) });

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
    return NextResponse.json({ error: "Enter a join code." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  const { data: comp } = await admin
    .from("competitions")
    .select("id, closes_at, max_team_size, is_published")
    .eq("slug", slug)
    .maybeSingle();

  if (!comp || !comp.is_published) {
    return NextResponse.json({ error: "Competition not found." }, { status: 404 });
  }
  if (new Date(comp.closes_at) <= new Date()) {
    return NextResponse.json({ error: "This competition has closed." }, { status: 409 });
  }

  const { data: team } = await admin
    .from("competition_teams")
    .select("id, name")
    .eq("competition_id", comp.id)
    .eq("join_code", normaliseGroupJoinCode(body.join_code))
    .maybeSingle();

  if (!team) return NextResponse.json({ error: "No team with that code." }, { status: 404 });

  const { count } = await admin
    .from("competition_members")
    .select("user_id", { count: "exact", head: true })
    .eq("team_id", team.id);

  if ((count ?? 0) >= comp.max_team_size) {
    return NextResponse.json(
      { error: `That team is full (${comp.max_team_size} maximum).` },
      { status: 409 },
    );
  }

  const { error } = await admin.from("competition_members").insert({
    team_id: team.id,
    user_id: user.id,
    competition_id: comp.id,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You are already in a team for this competition." },
        { status: 409 },
      );
    }
    console.error("[competition] join failed", error.message);
    return NextResponse.json({ error: "Could not join." }, { status: 500 });
  }

  return NextResponse.json({ team_id: team.id, team_name: team.name });
}
