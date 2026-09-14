import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { getQuotaStatus, quotaDenial } from "@/lib/quota";
import { critiqueBullets } from "@/lib/ai/resume-critique";
import { RateLimitError } from "@/lib/ai/errors";
import { recordUsage } from "@/lib/usage";
import { RESUME_LIMITS, parseBullets } from "@/lib/resume";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().max(RESUME_LIMITS.maxBullets * (RESUME_LIMITS.maxBulletChars + 20)),
  target_role: z.string().trim().max(RESUME_LIMITS.maxRoleChars).optional(),
});

/**
 * Critiques a set of resume bullets.
 *
 * Order matters, and each step exists to stop money being spent that should
 * not be: licence, then a stored critique of the identical input (free), then
 * quota, then the model call. The row is written only once the model answered
 * and the invented-number pass has run — a failed call costs the student
 * nothing against their allowance.
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
    return NextResponse.json({ error: "That is too much text to critique at once." }, { status: 400 });
  }

  const bullets = parseBullets(body.text);
  const targetRole = body.target_role?.trim() || null;

  if (bullets.length === 0) {
    return NextResponse.json({ error: "Paste at least one bullet, one per line." }, { status: 400 });
  }
  if (bullets.length > RESUME_LIMITS.maxBullets) {
    return NextResponse.json(
      { error: `Up to ${RESUME_LIMITS.maxBullets} bullets at a time. Split the rest into a second critique.` },
      { status: 400 },
    );
  }
  const long = bullets.findIndex((b) => b.length > RESUME_LIMITS.maxBulletChars);
  if (long !== -1) {
    return NextResponse.json(
      { error: `Bullet ${long + 1} is over ${RESUME_LIMITS.maxBulletChars} characters. A resume bullet should be two lines.` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  const inputHash = createHash("sha256")
    .update(JSON.stringify([targetRole?.toLowerCase() ?? "", bullets]))
    .digest("hex");

  // The same bullets for the same role: return what was already said. A second
  // call would cost money, spend the student's quota, and very likely disagree
  // with the first critique in small ways that help nobody.
  const { data: existing } = await admin
    .from("resume_critiques")
    .select("id, target_role, bullets, result, created_at")
    .eq("user_id", user.id)
    .eq("input_hash", inputHash)
    .is("erased_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.result) {
    return NextResponse.json({ critique: existing, cached: true });
  }

  const quota = await getQuotaStatus(admin, user.id);
  if (quota.gradingsLeft <= 0) {
    return NextResponse.json(quotaDenial("gradings", quota), { status: 402 });
  }

  try {
    const call = await critiqueBullets(bullets, targetRole);

    void recordUsage(admin, {
      userId: user.id,
      operation: "grading",
      model: call.model,
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
      cachedTokens: call.cachedTokens,
      totalTokens: call.tokensUsed,
    });

    const { data: row, error } = await admin
      .from("resume_critiques")
      .insert({
        user_id: user.id,
        target_role: targetRole,
        bullets,
        input_hash: inputHash,
        result: call.result,
        model: call.model,
      })
      .select("id, target_role, bullets, result, created_at")
      .single();

    if (error || !row) {
      console.error("[resume] could not store critique", error);
      // The critique exists and was paid for; show it even if it did not save.
      return NextResponse.json({
        critique: { id: null, target_role: targetRole, bullets, result: call.result, created_at: new Date().toISOString() },
      });
    }

    return NextResponse.json({ critique: row });
  } catch (err) {
    console.error("[resume] critique failed", err);
    if (err instanceof RateLimitError) {
      const wait = err.retryAfterSeconds;
      return NextResponse.json(
        {
          error: wait
            ? `The AI is busy. Wait about ${wait} seconds and try again — nothing was used from your allowance.`
            : "The AI is busy. Wait a moment and try again — nothing was used from your allowance.",
          code: "rate_limited",
          retry_after_seconds: wait,
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Could not critique those bullets. Try again — nothing was used from your allowance." },
      { status: 500 },
    );
  }
}
