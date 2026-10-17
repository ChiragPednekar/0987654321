import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { expertForUser } from "@/lib/experts";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  starts_at: z.string().datetime({ offset: true }),
  duration_minutes: z.number().int().refine((n) => [30, 45, 60].includes(n), "30, 45 or 60 minutes."),
});

/** Publishes a time an approved expert is free to interview. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const expert = await expertForUser(admin, user.id);
  if (!expert || expert.status !== "approved") {
    return NextResponse.json({ error: "Only approved experts can publish slots." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid slot." }, { status: 400 });

  const starts = new Date(parsed.data.starts_at);
  if (starts.getTime() < Date.now() + 3 * 3_600_000) {
    return NextResponse.json({ error: "Slots must start at least 3 hours from now." }, { status: 400 });
  }
  if (starts.getTime() > Date.now() + 60 * 86_400_000) {
    return NextResponse.json({ error: "Slots can be up to 60 days ahead." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("expert_slots")
    .insert({ expert_id: expert.id, starts_at: starts.toISOString(), duration_minutes: parsed.data.duration_minutes })
    .select("id")
    .single();
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "You already have a slot at that time." : "Could not add the slot." }, { status: duplicate ? 409 : 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
