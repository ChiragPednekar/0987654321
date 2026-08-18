import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Toggles the caller's upvote. The counter is kept in sync by a DB trigger. */
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
    .from("comment_votes")
    .select("comment_id")
    .eq("comment_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("comment_votes")
      .delete()
      .eq("comment_id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Could not remove vote" }, { status: 500 });
    }
    return NextResponse.json({ voted: false });
  }

  const { error } = await supabase
    .from("comment_votes")
    .insert({ comment_id: id, user_id: user.id });

  if (error) {
    return NextResponse.json({ error: "Could not vote" }, { status: 500 });
  }

  return NextResponse.json({ voted: true });
}
