import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Marks every unread notification read.
 *
 * Uses the caller's own client: RLS scopes rows to auth.uid(), and a
 * column-level grant means `read_at` is the only field this can touch even if
 * the query asked for more.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    return NextResponse.json(
      { error: "Could not mark notifications read" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
