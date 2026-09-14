import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { getQuotaStatus, quotaDenial } from "@/lib/quota";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ slug: z.string().trim().min(1).max(120) });

/**
 * Opens a sales role-play.
 *
 * Gated and metered exactly like negotiation: a multi-turn conversation with a
 * model has the cost shape of the interviewer, so it is a Pro feature checked
 * against the interview allowance.
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

  const admin = createAdminClient();
  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  const quota = await getQuotaStatus(admin, user.id);
  if (!quota.isPro) {
    return NextResponse.json(
      { error: "Sales role-play is a Pro feature.", code: "pro_required" },
      { status: 402 },
    );
  }
  if (quota.interviewsLeft <= 0) {
    return NextResponse.json(quotaDenial("interviews", quota), { status: 402 });
  }

  const { data: scenario } = await admin
    .from("sales_scenarios")
    .select("id")
    .eq("slug", body.slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!scenario) return NextResponse.json({ error: "Scenario not found." }, { status: 404 });

  const { data: session, error } = await admin
    .from("sales_sessions")
    .insert({ user_id: user.id, scenario_id: scenario.id })
    .select("id")
    .single();

  if (error || !session) {
    console.error("[sales] create failed", error?.message);
    return NextResponse.json({ error: "Could not start." }, { status: 500 });
  }
  return NextResponse.json({ id: session.id }, { status: 201 });
}
