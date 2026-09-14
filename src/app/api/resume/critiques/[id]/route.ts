import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Erases a critique's content.
 *
 * Not a row delete: the row has to go on counting toward the grading quota, or
 * deleting old critiques would refund the allowance. Everything about the
 * person — bullets, target role, the critique, the hash of the input — is
 * cleared, and the table's check constraint refuses an erased row that still
 * holds any of it. See 20250101000047.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Critique not found." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: erased, error } = await admin
    .from("resume_critiques")
    .update({
      bullets: null,
      target_role: null,
      result: null,
      input_hash: null,
      model: null,
      erased_at: new Date().toISOString(),
    })
    .eq("id", id)
    // Scoped to the caller in the query itself, so another user's id simply
    // matches nothing rather than relying on a separate ownership check.
    .eq("user_id", user.id)
    .is("erased_at", null)
    .select("id");

  if (error) {
    console.error("[resume] erase failed", error);
    return NextResponse.json({ error: "Could not delete that critique." }, { status: 500 });
  }
  if (!erased || erased.length === 0) {
    return NextResponse.json({ error: "Critique not found." }, { status: 404 });
  }

  return NextResponse.json({ erased: true });
}
