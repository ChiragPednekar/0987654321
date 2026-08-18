import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Toggles an upvote on a public solution. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("submission_votes")
    .select("submission_id")
    .eq("submission_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("submission_votes")
      .delete()
      .eq("submission_id", id)
      .eq("user_id", user.id);
    return NextResponse.json({ voted: false });
  }

  const { error } = await supabase
    .from("submission_votes")
    .insert({ submission_id: id, user_id: user.id });

  if (error) {
    return NextResponse.json({ error: "Could not vote" }, { status: 500 });
  }

  return NextResponse.json({ voted: true });
}
