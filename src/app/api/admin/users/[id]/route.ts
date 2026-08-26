import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireAdminActor } from "@/lib/authz";

const bodySchema = z.object({
  deactivated: z.boolean(),
  reason: z.string().trim().max(500).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Deactivates or restores an account (spec §32).
 *
 * Deliberately not a delete. Deleting through GoTrue cascades away the user's
 * submissions, scores and any marks a teacher gave them — so removing one
 * abusive account would also destroy the evidence of what it did, with no way
 * back from a mistake. Deactivation keeps the record and closes the account:
 * has_pro() goes false and quota_status() returns a zero allowance, so
 * /api/submissions answers 402 before a model is ever called.
 *
 * Reversible on purpose. An admin acting on a report at 2am should not need to
 * be certain.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  let actor;
  try {
    actor = await requireAdminActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  const { id } = await params;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request")
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Locking yourself out of the only admin account is unrecoverable without
  // database access, and there is exactly one platform owner.
  if (id === actor.id) {
    return NextResponse.json(
      { error: "You cannot deactivate your own account." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("users")
    .select("id, email, role, deactivated_at")
    .eq("id", id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const { error } = await admin
    .from("users")
    .update({
      deactivated_at: body.deactivated ? new Date().toISOString() : null,
      deactivated_reason: body.deactivated ? (body.reason ?? null) : null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The person finds out from the product rather than by discovering features
  // have stopped working.
  await admin.from("notifications").insert({
    user_id: id,
    type: "system",
    title: body.deactivated ? "Your account has been deactivated" : "Your account is active again",
    body: body.deactivated
      ? body.reason
        ? `Reason: ${body.reason}`
        : "Contact support if you think this is a mistake. Your work is not deleted."
      : "Full access has been restored.",
    href: "/dashboard",
  });

  await audit(
    actor,
    body.deactivated ? "user.deactivate" : "user.reactivate",
    "users",
    id,
    { email: target.email, role: target.role, reason: body.reason ?? null },
  );

  return NextResponse.json({ ok: true, deactivated: body.deactivated });
}
