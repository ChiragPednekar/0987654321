import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { END_REASONS, type EndReason } from "@/lib/camera-proctor";
import { signalsSchema } from "@/lib/integrity-request";

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

  const { data } = await createAdminClient()
    .from("exam_lockouts")
    .select("reason, created_at")
    .eq("user_id", user.id)
    .eq("path", path.data)
    .is("reopened_at", null)
    .maybeSingle();

  return NextResponse.json(
    data ? { locked: true, reason: data.reason, at: data.created_at } : { locked: false },
  );
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
 * Idempotent: an open lock for the same page is a conflict on the partial
 * unique index, and the earliest ending is the one kept.
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

  const { error } = await createAdminClient().from("exam_lockouts").insert({
    user_id: user.id,
    path: body.path,
    reason: body.reason,
    signals: body.signals,
  });

  // 23505: already locked out of this page, which is the expected path on a
  // second fire and not a failure.
  if (error && error.code !== "23505") {
    console.error("[proctor] lockout failed", error.message);
    return NextResponse.json({ error: "Could not record" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
