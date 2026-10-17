import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { expertForUser, expertProfileSchema } from "@/lib/experts";

export const dynamic = "force-dynamic";

/** An expert edits their own profile: headline, bio, price, meeting link. */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const expert = await expertForUser(admin, user.id);
  if (!expert) return NextResponse.json({ error: "No expert profile." }, { status: 404 });
  if (expert.status === "suspended") return NextResponse.json({ error: "This profile is suspended." }, { status: 403 });

  const parsed = expertProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400 });
  }
  const { price_rupees, ...profile } = parsed.data;
  const { error } = await admin
    .from("experts")
    .update({ ...profile, price_paise: price_rupees * 100, linkedin_url: profile.linkedin_url ?? null, meeting_url: profile.meeting_url ?? null })
    .eq("id", expert.id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
