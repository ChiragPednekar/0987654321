import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzResponse, batchesTaughtBy, requireTeacherActor } from "@/lib/authz";

export const dynamic = "force-dynamic";

/**
 * The batches the signed-in teacher teaches — for the "Add to batch" picker on
 * the library pages, which open on any page and so cannot be handed the list
 * by a server component.
 */
export async function GET() {
  let actor;
  try {
    actor = await requireTeacherActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  const ids = await batchesTaughtBy(actor.id);
  if (ids.length === 0) return NextResponse.json({ batches: [] });

  const { data } = await createAdminClient()
    .from("classrooms")
    .select("id, name")
    .in("id", ids)
    .eq("archived", false)
    .order("name");

  return NextResponse.json({ batches: data ?? [] });
}
