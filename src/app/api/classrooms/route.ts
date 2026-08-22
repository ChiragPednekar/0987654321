import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
});

/** Six unambiguous characters — no O/0 or I/1, because people read these aloud. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function joinCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Creates a classroom (spec §11).
 *
 * Service role throughout: the join code must be generated server-side (a
 * client-chosen code could be made guessable), and the creator has to land in
 * classroom_members as a teacher atomically or the classroom is unreachable.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request")
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { count: owned } = await admin
    .from("classrooms")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if ((owned ?? 0) >= 20) {
    return NextResponse.json(
      { error: "You already own 20 classrooms." },
      { status: 429 },
    );
  }

  // Retry on the unique constraint rather than pre-checking: at this table
  // size a collision is vanishingly rare, and the constraint is the authority.
  let created: { id: string; join_code: string } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
    const { data, error } = await admin
      .from("classrooms")
      .insert({
        name: body.name,
        description: body.description ?? null,
        owner_id: user.id,
        join_code: joinCode(),
      })
      .select("id, join_code")
      .single();

    if (!error && data) created = data;
    else if (error && error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (!created) {
    return NextResponse.json(
      { error: "Could not allocate a join code." },
      { status: 500 },
    );
  }

  const { error: memberError } = await admin
    .from("classroom_members")
    .insert({ classroom_id: created.id, user_id: user.id, role: "teacher" });

  if (memberError) {
    await admin.from("classrooms").delete().eq("id", created.id);
    return NextResponse.json(
      { error: "Could not create the classroom." },
      { status: 500 },
    );
  }

  return NextResponse.json(created, { status: 201 });
}
