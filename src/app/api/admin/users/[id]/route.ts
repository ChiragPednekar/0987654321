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

  // Deliberately does not select `deactivated_at`. Selecting a column the
  // database may not have turns a working lookup into an error, and the error
  // path here reported "Account not found" — which is both wrong and the least
  // helpful thing it could have said.
  const { data: target, error: lookupError } = await admin
    .from("users")
    .select("id, email, role")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    console.error("[admin] account lookup failed", lookupError);
    return NextResponse.json(
      { error: "Could not read that account." },
      { status: 500 },
    );
  }

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
    // The deactivation columns arrive with 20250101000026, and a deployment can
    // be ahead of its database. Two different codes mean the same thing here:
    // Postgres answers 42703 ("column does not exist") when it plans the
    // statement, while PostgREST answers PGRST204 earlier, from its own schema
    // cache, without ever reaching the database. The message differs too, so
    // both are matched rather than either alone.
    const missingColumn =
      error.code === "42703" ||
      error.code === "PGRST204" ||
      /deactivated_at/.test(error.message ?? "");

    if (missingColumn) {
      console.error("[admin] deactivation columns missing", error.message);
      return NextResponse.json(
        {
          error:
            "Account deactivation is not available yet — this database is missing the deactivation columns. Apply migration 20250101000026_user_deactivation.sql, then try again.",
        },
        { status: 503 },
      );
    }
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
