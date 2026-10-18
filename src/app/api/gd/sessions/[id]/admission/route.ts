import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function hostFor(id: string, userId: string) {
  const admin = createAdminClient();
  const { data: session } = await admin.from("gd_sessions")
    .select("host_id, max_participants, status")
    .eq("id", id)
    .maybeSingle();
  if (!session || session.host_id !== userId) return null;
  return { admin, session };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const access = await hostFor(id, user.id);
  if (!access) return NextResponse.json({ error: "Only the host can manage requests." }, { status: 403 });
  const { data } = await access.admin.from("gd_participants")
    .select("user_id, joined_at, users(full_name, email)")
    .eq("session_id", id)
    .eq("admission_status", "pending")
    .order("joined_at", { ascending: true });
  return NextResponse.json({
    requests: (data ?? []).map((row) => {
      const profile = Array.isArray(row.users) ? row.users[0] : row.users;
      return {
        userId: row.user_id,
        name: profile?.full_name || profile?.email?.split("@")[0] || "Guest",
      };
    }),
  });
}

const decisionSchema = z.object({
  userId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const access = await hostFor(id, user.id);
  if (!access) return NextResponse.json({ error: "Only the host can manage requests." }, { status: 403 });

  let body: z.infer<typeof decisionSchema>;
  try {
    body = decisionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: requestRow } = await access.admin.from("gd_participants")
    .select("user_id, admission_status")
    .eq("session_id", id)
    .eq("user_id", body.userId)
    .maybeSingle();
  if (!requestRow || requestRow.admission_status !== "pending") {
    return NextResponse.json({ error: "This join request is no longer waiting." }, { status: 409 });
  }

  if (body.decision === "approve") {
    if (access.session.status === "completed" || access.session.status === "cancelled") {
      return NextResponse.json({ error: "This meeting has ended." }, { status: 409 });
    }
    const { data: active } = await access.admin.from("gd_participants")
      .select("user_id")
      .eq("session_id", id)
      .eq("admission_status", "approved")
      .is("left_at", null);
    if ((active ?? []).length >= access.session.max_participants) {
      return NextResponse.json({ error: "This meeting is full." }, { status: 409 });
    }
  }

  const { error } = await access.admin.from("gd_participants")
    .update({
      admission_status: body.decision === "approve" ? "approved" : "rejected",
      left_at: null,
    })
    .eq("session_id", id)
    .eq("user_id", body.userId)
    .eq("admission_status", "pending");
  if (error) {
    console.error("[gd] admission decision failed", error.message);
    return NextResponse.json({ error: "Could not update the join request." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
