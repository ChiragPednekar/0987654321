import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireAdminActor } from "@/lib/authz";
import { internalError } from "@/lib/http-errors";
import { nextPeriodEnd, planForDays } from "@/lib/subscription";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const grantSchema = z.object({
  days: z.number().int().min(1).max(730),
  reason: z.string().trim().max(500).optional().nullable(),
});

/**
 * Grants an individual Pro subscription by hand, for a set number of days.
 *
 * For a complimentary month, making good a payment that failed to register,
 * or testing the subscription path without taking a payment. It is the same
 * kind of row a payment creates — status 'active' with a period end — so it
 * runs out on its own exactly like a paid one; `source = 'manual'` and
 * `granted_by` record that nobody paid. Added on top of any live period.
 */
export async function POST(request: NextRequest, { params }: Params) {
  let actor;
  try {
    actor = await requireAdminActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  let body: z.infer<typeof grantSchema>;
  try {
    body = grantSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Give a number of days between 1 and 730." }, { status: 400 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: target } = await admin.from("users").select("id").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // A grant starts now, so it takes effect at once; its allowance is that of
  // the plan whose length it is closest to.
  const startsAt = new Date();
  const endsAt = nextPeriodEnd(null, body.days, startsAt).toISOString();

  const { data: row, error } = await admin
    .from("subscriptions")
    .insert({
      user_id: id,
      plan: "pro",
      status: "active",
      source: "manual",
      granted_by: actor.id,
      plan_code: planForDays(body.days),
      period_start: startsAt.toISOString(),
      current_period_end: endsAt,
    })
    .select("id")
    .single();
  if (error || !row) return internalError("admin", error, "Could not grant the subscription.");

  await audit(actor, "subscription.grant", "subscriptions", row.id, {
    user_id: id,
    days: body.days,
    ends_at: endsAt,
    reason: body.reason ?? null,
  });
  return NextResponse.json({ ends_at: endsAt }, { status: 201 });
}

/**
 * Ends every hand-granted period on the account now. Paid periods are left
 * alone: taking away something a student paid for is a refund decision, made
 * in Razorpay, not a button here.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  let actor;
  try {
    actor = await requireAdminActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const now = new Date().toISOString();
  // Only grants still running: one that has already lapsed ends nothing.
  const { data, error } = await admin
    .from("subscriptions")
    .update({ status: "cancelled", current_period_end: now, updated_at: now })
    .eq("user_id", id)
    .eq("source", "manual")
    .eq("status", "active")
    .gt("current_period_end", now)
    .select("id");
  if (error) return internalError("admin", error, "Could not end the subscription.");

  await audit(actor, "subscription.end_manual", "subscriptions", null, {
    user_id: id,
    ended: (data ?? []).length,
  });
  return NextResponse.json({ ended: (data ?? []).length });
}
