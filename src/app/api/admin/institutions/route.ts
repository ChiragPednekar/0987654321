import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(160),
  // Bare domain, no '@'. Lowercased so matching in handle_new_user is stable.
  email_domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Use a bare domain, e.g. iimb.ac.in")
    .optional()
    .nullable(),
  seats_licensed: z.number().int().min(0).max(100_000).default(0),
  licence_starts_on: z.string().date().optional().nullable(),
  licence_ends_on: z.string().date().optional().nullable(),
  grants_pro: z.boolean().default(true),
  /** Email of the placement-cell contact who gets staff access. */
  staff_email: z.string().email().optional(),
});

/**
 * Creates a campus licence (spec: institution layer).
 *
 * Platform-admin only. Seats and licence dates are contractual terms — nothing
 * a college user does in the product should be able to change them, which is
 * why 20250101000019 revokes writes on both tables from authenticated.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const admin = createAdminClient();

  const base = slugify(body.name).slice(0, 50) || "campus";
  let slug = base;
  for (let n = 2; n <= 20; n += 1) {
    const { data: taken } = await admin
      .from("institutions")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${n}`;
  }

  const { data: institution, error } = await admin
    .from("institutions")
    .insert({
      name: body.name,
      slug,
      email_domain: body.email_domain ?? null,
      seats_licensed: body.seats_licensed,
      licence_starts_on: body.licence_starts_on ?? null,
      licence_ends_on: body.licence_ends_on ?? null,
      grants_pro: body.grants_pro,
    })
    .select("id, slug, name")
    .single();

  if (error || !institution) {
    // A duplicate domain is the likely failure and is worth saying plainly:
    // two institutions sharing one domain would enrol students at random.
    const duplicate = error?.code === "23505";
    return NextResponse.json(
      {
        error: duplicate
          ? "That email domain is already licensed to another institution."
          : (error?.message ?? "Could not create the institution."),
      },
      { status: duplicate ? 409 : 500 },
    );
  }

  // Attach the placement-cell contact as staff, if they already have an
  // account. If they do not, they get enrolled as a student by domain on
  // signup and an admin promotes them — better than silently doing nothing.
  let staffAttached = false;
  if (body.staff_email) {
    const { data: staff } = await admin
      .from("users")
      .select("id")
      .eq("email", body.staff_email.toLowerCase())
      .maybeSingle();

    if (staff) {
      await admin.from("institution_members").upsert(
        { institution_id: institution.id, user_id: staff.id, role: "staff" },
        { onConflict: "institution_id,user_id" },
      );
      staffAttached = true;
    }
  }

  return NextResponse.json(
    { ...institution, staff_attached: staffAttached },
    { status: 201 },
  );
}

/** Lists licences with live seat usage, for the platform admin. */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: institutions } = await admin
    .from("institutions")
    .select("*")
    .order("created_at", { ascending: false });

  const withUsage = await Promise.all(
    (institutions ?? []).map(async (i) => {
      const { count } = await admin
        .from("institution_members")
        .select("user_id", { count: "exact", head: true })
        .eq("institution_id", i.id)
        .eq("role", "student");
      return { ...i, seats_used: count ?? 0 };
    }),
  );

  return NextResponse.json({ institutions: withUsage });
}
