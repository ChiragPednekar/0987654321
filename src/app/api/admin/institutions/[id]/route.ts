import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Every field optional: this endpoint serves both the full edit form and the
// single-field suspend toggle, and a partial update should not blank the rest.
const bodySchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  email_domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Use a bare domain, e.g. iimb.ac.in")
    .nullable()
    .optional(),
  seats_licensed: z.number().int().min(0).max(100_000).optional(),
  licence_starts_on: z.string().date().nullable().optional(),
  licence_ends_on: z.string().date().nullable().optional(),
  contract_value_inr: z.number().int().min(0).nullable().optional(),
  billing_contact_email: z.string().email().nullable().optional(),
  grading_quota: z.number().int().min(0).nullable().optional(),
  interview_quota: z.number().int().min(0).nullable().optional(),
  grants_pro: z.boolean().optional(),
  is_suspended: z.boolean().optional(),
  notes: z.string().trim().max(4_000).nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

/** Updates a campus licence. Platform-admin only. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("institutions")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json(
      {
        error: duplicate
          ? "That email domain is already licensed to another institution."
          : error.message,
      },
      { status: duplicate ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

/** Deletes a licence. Members lose access; their accounts and work survive. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { error } = await admin.from("institutions").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
