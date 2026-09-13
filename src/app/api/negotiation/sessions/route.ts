import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { getQuotaStatus, quotaDenial } from "@/lib/quota";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ slug: z.string().trim().min(1).max(120) });

/** Opens a negotiation against a seeded case. */
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

  // Metered like the interviewer: it is a multi-turn conversation with a model
  // and costs the same shape. The simulation is free because its engine is
  // arithmetic; this one genuinely is not.
  const quota = await getQuotaStatus(admin, user.id);
  if (!quota.isPro) {
    return NextResponse.json(
      { error: "Negotiation practice is a Pro feature.", code: "pro_required" },
      { status: 402 },
    );
  }
  if (quota.interviewsLeft <= 0) {
    return NextResponse.json(quotaDenial("interviews", quota), { status: 402 });
  }

  const { data: kase } = await admin
    .from("negotiation_cases")
    .select("id")
    .eq("slug", body.slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!kase) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const { data: session, error } = await admin
    .from("negotiation_sessions")
    .insert({ user_id: user.id, case_id: kase.id })
    .select("id")
    .single();

  if (error || !session) {
    console.error("[negotiation] create failed", error?.message);
    return NextResponse.json({ error: "Could not start." }, { status: 500 });
  }

  return NextResponse.json({ id: session.id }, { status: 201 });
}
