import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signalsSchema } from "@/lib/integrity-request";
import { recordActivityIntegrity } from "@/lib/proctoring";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ signals: signalsSchema });

/**
 * One participant's proctor counters for a group discussion.
 *
 * Its own route, not part of /end, because a discussion is ended by one
 * person and every other participant simply leaves. Each browser therefore
 * reports for itself — when its owner presses End, and again via sendBeacon
 * as the page is closed, because a normal request is often cancelled while a
 * page unloads.
 *
 * Accepted after the room has ended, deliberately: the last report arrives as
 * people close the tab, which is usually after /end has run. And reporting
 * twice is expected, so earlier rows for the same person and room are marked
 * superseded rather than counted again — one discussion can only ever be one
 * finding, and one strike at most.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    // .text() then parse, because sendBeacon posts a Blob whose content type
    // a browser may not let a page set.
    body = bodySchema.parse(JSON.parse(await request.text()));
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Membership, not mere sign-in: a stranger must not be able to write
  // findings against a room they were never in.
  const { data: member } = await admin
    .from("gd_participants")
    .select("user_id")
    .eq("session_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "You are not in this room." }, { status: 403 });
  }

  const integrity = await recordActivityIntegrity(admin, {
    userId: user.id,
    activity: "group_discussion",
    activityRef: id,
    signals: body.signals,
    supersedePrevious: true,
  });

  return NextResponse.json({ ok: true, integrity_warning: integrity.warning });
}
