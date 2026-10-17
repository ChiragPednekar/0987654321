import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireAdminActor } from "@/lib/authz";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ action: z.enum(["approve", "suspend", "mark_paid"]) });

/**
 * Admin decisions on an expert: approve an application, suspend a profile, or
 * record that their completed sessions have been paid out (the transfer itself
 * happens outside the app).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requireAdminActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const admin = createAdminClient();
  const { data: expert } = await admin.from("experts").select("id, user_id, display_name").eq("id", id).maybeSingle();
  if (!expert) return NextResponse.json({ error: "Expert not found." }, { status: 404 });

  if (parsed.data.action === "mark_paid") {
    const { data } = await admin
      .from("expert_bookings")
      .update({ payout_status: "paid", paid_out_at: new Date().toISOString() })
      .eq("expert_id", id)
      .eq("status", "completed")
      .eq("payout_status", "pending")
      .select("payout_paise");
    const total = (data ?? []).reduce((s, b) => s + b.payout_paise, 0);
    await audit(actor, "expert.payout", "experts", id, { sessions: (data ?? []).length, payout_paise: total });
    return NextResponse.json({ sessions: (data ?? []).length, payout_paise: total });
  }

  const approve = parsed.data.action === "approve";
  await admin
    .from("experts")
    .update(approve ? { status: "approved", approved_at: new Date().toISOString(), approved_by: actor.id } : { status: "suspended" })
    .eq("id", id);
  if (!approve) {
    // A suspended expert's free slots come off sale; booked ones stay for the team to handle.
    await admin.from("expert_slots").update({ status: "cancelled" }).eq("expert_id", id).eq("status", "open");
  }
  if (approve) {
    await admin.from("notifications").insert({
      user_id: expert.user_id,
      type: "system",
      title: "You're approved as a CaseCode expert",
      body: "Publish your first interview slots to start taking bookings.",
      href: "/experts/dashboard",
    });
  }
  await audit(actor, approve ? "expert.approve" : "expert.suspend", "experts", id, { name: expert.display_name });
  return NextResponse.json({ ok: true });
}
