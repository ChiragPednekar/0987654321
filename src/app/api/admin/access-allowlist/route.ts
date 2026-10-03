import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireAdminActor } from "@/lib/authz";

const addSchema = z.object({
  email: z.string().trim().toLowerCase().email("That is not a valid email."),
  note: z.string().trim().max(200).optional().nullable(),
});

const removeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

/**
 * Who may hold an account at all.
 *
 * Separate from role_grants, which answers "which dashboard", and from
 * solve_allowlist, which answers "may this account spend AI budget". This one
 * answers "may this address exist here" — the trigger on auth.users refuses to
 * create an account for anything not listed, and the RESTRICTIVE content
 * policies return nothing to an account whose row is later removed.
 *
 * Listing an address before they sign up is the normal case, not an edge one.
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
    .from("access_allowlist")
    .select("email, note, created_at")
    .order("email");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(request: NextRequest) {
  let actor;
  try {
    actor = await requireAdminActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  let body: z.infer<typeof addSchema>;
  try {
    body = addSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request")
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("access_allowlist").upsert(
    { email: body.email, note: body.note ?? null, granted_by: actor.id },
    { onConflict: "email" },
  );

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json(
        {
          error:
            "The access list is missing from this database. Apply migration 20250101000060_invite_only_access.sql.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await audit(actor, "access.grant", "access_allowlist", body.email, {});
  return NextResponse.json({ ok: true, email: body.email });
}

export async function DELETE(request: NextRequest) {
  let actor;
  try {
    actor = await requireAdminActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  let body: z.infer<typeof removeSchema>;
  try {
    body = removeSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  /**
   * Refuse to strip access from an admin.
   *
   * There is no recovery path through the product: removing the last owner's
   * address sends them to /no-access on every page, including this one, and
   * the only way back would be SQL against the database. role_grants protects
   * its last admin in the database for the same reason; this is the matching
   * guard one table over.
   */
  const { data: grant } = await admin
    .from("role_grants")
    .select("role")
    .eq("email", body.email)
    .maybeSingle();

  if (grant?.role === "admin") {
    return NextResponse.json(
      {
        error:
          "That address is an admin. Remove the admin role first, or it would be locked out of the page you are standing on.",
      },
      { status: 409 },
    );
  }

  const { error } = await admin
    .from("access_allowlist")
    .delete()
    .eq("email", body.email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await audit(actor, "access.revoke", "access_allowlist", body.email, {});
  return NextResponse.json({ ok: true, email: body.email });
}
