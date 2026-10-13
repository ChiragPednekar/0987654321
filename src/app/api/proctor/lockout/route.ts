import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { END_REASONS, type EndReason } from "@/lib/camera-proctor";
import { signalsSchema } from "@/lib/integrity-request";
import { activeLockout, recordLockout } from "@/lib/exam-lockouts";

export const dynamic = "force-dynamic";

/** A page path, as `location.pathname` gives it. Never a full URL or a query. */
const pathSchema = z
  .string()
  .min(1)
  .max(300)
  .regex(/^\/[^?#\s]*$/);

const bodySchema = z.object({
  path: pathSchema,
  reason: z.enum(END_REASONS as [EndReason, ...EndReason[]]),
  signals: signalsSchema,
});

/**
 * Whether the camera has locked this account out of this page.
 *
 * Asked by every proctored page as it loads, so that reloading a test the
 * camera ended brings back the ended screen rather than a fresh Start button.
 * A failure here answers "not locked": the page then behaves as it did before
 * lockouts existed, which is better than refusing honest students a test
 * because a lookup timed out.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ locked: false });

  const path = pathSchema.safeParse(request.nextUrl.searchParams.get("path"));
  if (!path.success) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  // A lock past its 24 hours answers "not locked": the page opens again.
  const { state } = await activeLockout(createAdminClient(), user.id, path.data);
  return NextResponse.json(state ? { locked: true, ...state } : { locked: false });
}

/**
 * Records that the camera ended this account's test on this page.
 *
 * Sent by the browser the moment the page freezes. A student with devtools can
 * stop it being sent, as they can stop any proctor signal — but a student who
 * does that also has to stop the freeze itself, and this row is what makes the
 * freeze survive the obvious reload. The one thing a forged request can do is
 * lock its own sender out, which needs no defending against.
 *
 * Each ending is a strike on this page: the first two lock it for 24 hours,
 * the third for good (see recordLockout). Idempotent while a lock is in
 * force — a second fire returns the lock it found rather than adding a
 * strike. The response is the lock, so the ended screen can say when the
 * student may try again.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const state = await recordLockout(createAdminClient(), {
    userId: user.id,
    path: body.path,
    reason: body.reason,
    signals: body.signals,
  });
  if (!state) return NextResponse.json({ error: "Could not record" }, { status: 500 });
  return NextResponse.json({ ok: true, ...state });
}
