import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ case_id: z.string().uuid() });

/**
 * Bookmarks are written with the caller's own client, not the admin one: RLS
 * already restricts rows to `auth.uid()`, so there is nothing here that needs
 * to bypass it.
 */
async function parse(request: NextRequest) {
  try {
    return bodySchema.parse(await request.json());
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await parse(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Idempotent: saving an already-saved case is a no-op rather than an error.
  const { error } = await supabase
    .from("bookmarks")
    .upsert({ user_id: user.id, case_id: body.case_id });

  if (error) {
    return NextResponse.json(
      { error: "Could not save bookmark" },
      { status: 500 },
    );
  }

  return NextResponse.json({ saved: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await parse(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", user.id)
    .eq("case_id", body.case_id);

  if (error) {
    return NextResponse.json(
      { error: "Could not remove bookmark" },
      { status: 500 },
    );
  }

  return NextResponse.json({ saved: false });
}
