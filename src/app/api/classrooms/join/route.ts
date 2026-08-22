import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  join_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, "Join codes are six letters and numbers."),
});

/** Join a classroom by code (spec §11). */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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

  const { data: classroom } = await admin
    .from("classrooms")
    .select("id, archived")
    .eq("join_code", body.join_code)
    .maybeSingle();

  // Same message either way: a distinct "no such code" would turn this into a
  // way to enumerate valid codes.
  if (!classroom || classroom.archived) {
    return NextResponse.json(
      { error: "That code does not match an open classroom." },
      { status: 404 },
    );
  }

  const { error } = await admin
    .from("classroom_members")
    .upsert(
      { classroom_id: classroom.id, user_id: user.id, role: "student" },
      { onConflict: "classroom_id,user_id", ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json({ error: "Could not join." }, { status: 500 });
  }

  return NextResponse.json({ classroom_id: classroom.id });
}
