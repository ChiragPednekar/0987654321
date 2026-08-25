import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "staff", "student"]).default("staff"),
});

type Params = { params: Promise<{ id: string }> };

/** Adds or re-roles a member of an institution. Platform-admin only. */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  return NextResponse.json({ ok: true, role: body.role });
}
