import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { expertForUser, expertProfileSchema } from "@/lib/experts";

export const dynamic = "force-dynamic";

/**
 * Applies to run paid mock interviews. Creates a pending profile an admin
 * reviews; nothing is listed or bookable until it is approved. Applying
 * again edits the pending application rather than creating a second one.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = expertProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400 });
  }
  const { price_rupees, ...profile } = parsed.data;

  const admin = createAdminClient();
  const existing = await expertForUser(admin, user.id);
  if (existing && existing.status !== "pending") {
    return NextResponse.json({ error: "You already have an expert profile." }, { status: 409 });
  }

  const row = { ...profile, price_paise: price_rupees * 100, linkedin_url: profile.linkedin_url ?? null, meeting_url: profile.meeting_url ?? null };
  const { error } = existing
    ? await admin.from("experts").update(row).eq("id", existing.id)
    : await admin.from("experts").insert({ ...row, user_id: user.id });
  if (error) {
    console.error("[experts] apply failed", error.message);
    return NextResponse.json({ error: "Could not save the application." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: "pending" }, { status: existing ? 200 : 201 });
}
