import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Erases a deck review's content. The row stays so it keeps counting toward
 * the grading allowance — see 20250101000053 and the resume critique's
 * equivalent route.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: erased, error } = await admin
    .from("deck_reviews")
    .update({
      file_name: null,
      context: null,
      input_hash: null,
      result: null,
      model: null,
      erased_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("erased_at", null)
    .select("id");

  if (error) {
    console.error("[deck] erase failed", error);
    return NextResponse.json({ error: "Could not delete that review." }, { status: 500 });
  }
  if (!erased || erased.length === 0) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
  return NextResponse.json({ erased: true });
}
