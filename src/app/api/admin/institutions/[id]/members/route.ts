import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireAdminActor } from "@/lib/authz";

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "staff", "student"]).default("staff"),
});

type Params = { params: Promise<{ id: string }> };

/** Adds or re-roles a member of an institution. Platform-admin only. */
export async function POST(request: NextRequest, { params }: Params) {
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
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: user } = await admin
    .from("users")
    .select("id")
    .eq("email", body.email.toLowerCase())
    .maybeSingle();

  if (!user) {
    return NextResponse.json(
      { error: "No account with that email yet — ask them to sign up first." },
      { status: 404 },
    );
  }

  const { error } = await admin
    .from("institution_members")
    .upsert(
      { institution_id: id, user_id: user.id, role: body.role },
      { onConflict: "institution_id,user_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Granting institution staff hands someone the cohort dashboard for a whole
  // college, so it belongs in the trail alongside the licence changes.
  await audit(actor, "institution.member_role", "institution_members", id, {
    email: body.email.toLowerCase(),
    role: body.role,
  });

  return NextResponse.json({ ok: true, role: body.role });
}
