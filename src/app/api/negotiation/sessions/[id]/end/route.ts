import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { signalsSchema } from "@/lib/integrity-request";
import { recordActivityIntegrity } from "@/lib/proctoring";
import { EMPTY_SIGNALS } from "@/lib/integrity";

export const dynamic = "force-dynamic";

/**
 * Walks away.
 *
 * A deliberate no-deal is a legitimate and sometimes correct outcome, so it is
 * recorded as one rather than as an abandoned session. The scorecard then says
 * whether walking was right: if the best offer on the table was below the
 * student's own BATNA, it was.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  /**
   * Tolerant: this route was previously called with no body, and a tab open
   * across the deploy still will be. No signals means nothing was reported,
   * which assessIntegrity reads as an absence of evidence.
   */
  const signals = await request
    .json()
    .then((raw) => z.object({ signals: signalsSchema }).parse(raw).signals)
    .catch(() => EMPTY_SIGNALS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("negotiation_sessions")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Not your negotiation." }, { status: 403 });
  }
  if (session.status !== "live") return NextResponse.json({ ok: true, already: true });

  await admin
    .from("negotiation_sessions")
    .update({ status: "no_deal", ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "live");

  /**
   * Only the student's own words. Counting the model's replies too would
   * inflate the denominator and make every sitting look under-typed, which is
   * precisely the false positive the typing check exists to avoid.
   */
  const { data: mine } = await admin
    .from("negotiation_messages")
    .select("content")
    .eq("session_id", id)
    .eq("role", "student");

  const studentChars = (mine ?? []).reduce(
    (total, row) => total + (row.content?.length ?? 0),
    0,
  );

  /**
   * One verdict for the sitting, recorded after the session is safely closed
   * so a failure here cannot cost the student the work they already did. No
   * ai_likelihood: nothing in this path asks a model to judge authorship, and
   * inventing a number would be worse than having none.
   */
  const integrity = await recordActivityIntegrity(admin, {
    userId: user.id,
    activity: "negotiation",
    activityRef: id,
    signals,
    answerChars: studentChars,
  });

  return NextResponse.json({ ok: true, integrity_warning: integrity.warning });
}
