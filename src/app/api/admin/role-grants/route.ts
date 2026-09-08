import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireAdminActor } from "@/lib/authz";

const grantSchema = z.object({
  email: z.string().trim().toLowerCase().email("That is not a valid email."),
  // 'student' is the absence of a grant, not a value — the table's check
  // constraint rejects it, and accepting it here would only produce a 500.
  role: z.enum(["teacher", "admin", "recruiter"]),
  note: z.string().trim().max(200).optional().nullable(),
});

const revokeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

/**
 * The email allowlist that decides who sees which dashboard.
 *
 * Roles used to be conferred by editing users.role by hand in SQL. That leaves
 * no record of who granted what, cannot prepare access for somebody who has
 * not signed up yet, and means onboarding a teacher requires database access —
 * which is not a thing you want to hand out.
 *
 * Writing here is the only supported way to elevate an account. The trigger on
 * the table applies the change to an existing user immediately, so a teacher
 * who is already sitting on the student dashboard only has to reload.
 */
export async function GET() {
  try {
    await requireAdminActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("role_grants")
    .select("email, role, note, created_at, updated_at")
    .order("role")
    .order("email");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ grants: data ?? [] });
}

export async function POST(request: NextRequest) {
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
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request")
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("role_grants")
    .upsert(
      {
        email: body.email,
        role: body.role,
        note: body.note ?? null,
        granted_by: actor.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );

  if (error) {
    if (error.code === "42P01" || /role_grants/.test(error.message ?? "")) {
      return NextResponse.json(
        {
          error:
            "Access control is not available yet — this database is missing the allowlist. Apply migration 20250101000031_role_grants.sql.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await audit(actor, "role_grant.set", "role_grants", body.email, {
    role: body.role,
  });

  return NextResponse.json({ ok: true, email: body.email, role: body.role });
}

export async function DELETE(request: NextRequest) {
  let actor;
  try {
    actor = await requireAdminActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  let body: z.infer<typeof revokeSchema>;
  try {
    body = revokeSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("role_grants")
    .delete()
    .eq("email", body.email);

  if (error) {
    // The database refuses to drop the last admin grant (P0001). Surface that
    // sentence rather than a generic failure — it says exactly what to do.
    const status = error.code === "P0001" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  await audit(actor, "role_grant.revoke", "role_grants", body.email, {});

  return NextResponse.json({ ok: true, email: body.email });
}
