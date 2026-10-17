import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { expertForUser } from "@/lib/experts";

export const dynamic = "force-dynamic";

/**
 * Withdraws a slot nobody has booked. A booked slot cannot be withdrawn here:
 * a student has paid for it, and cancelling a paid session is a refund
 * decision for the CaseCode team.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const expert = await expertForUser(admin, user.id);
  if (!expert) return NextResponse.json({ error: "No expert profile." }, { status: 404 });

  const { data } = await admin
    .from("expert_slots")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("expert_id", expert.id)
    .or(`status.eq.open,and(status.eq.held,held_until.lt."${new Date().toISOString()}")`)
    .select("id");
  if (!data?.length) {
    return NextResponse.json({ error: "That slot is booked or being paid for, so it cannot be withdrawn." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
