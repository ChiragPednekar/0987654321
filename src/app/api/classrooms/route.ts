import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  audit,
  authzResponse,
  requireBatchTeacher,
  requireTeacherActor,
} from "@/lib/authz";

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
 *
 * Requires the platform teacher role. It previously required only a session,
 * which let any student create a classroom and become its teacher — and the
 * legacy assignment route checks only classroom membership, so that student
 * could then set assignments inside it. The two role layers exist to be used
 * together: `users.role` says who may teach at all, `classroom_members.role`
 * says which batches.
 */
export async function POST(request: NextRequest) {
  let actor;
  try {
    actor = await requireTeacherActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
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
    .eq("owner_id", actor.id);

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
        owner_id: actor.id,
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
    .insert({ classroom_id: created.id, user_id: actor.id, role: "teacher" });

  if (memberError) {
    await admin.from("classrooms").delete().eq("id", created.id);
    return NextResponse.json(
      { error: "Could not create the classroom." },
      { status: 500 },
    );
  }

  await audit(actor, "classroom.create", "classrooms", created.id, {
    name: body.name,
  });

  return NextResponse.json(created, { status: 201 });
}

const patchSchema = z.object({
  classroom_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  /**
   * Archiving is the delete. A batch holds a term's assignments, marks and
   * remarks, so removing the row would take a student's academic record with
   * it; archiving closes the join code and takes it out of the teacher's
   * working list while leaving everything readable.
   */
  archived: z.boolean().optional(),
});

/** Renames or archives a batch. Scoped to the teacher who owns it. */
export async function PATCH(request: NextRequest) {
  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request")
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // The id came from the client, so prove they teach that batch.
  let actor;
  try {
    actor = await requireBatchTeacher(body.classroom_id);
  } catch (error) {
    const { body: b, status } = authzResponse(error);
    return NextResponse.json(b, { status });
  }

  const { classroom_id, ...changes } = body;
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("classrooms")
    .update(changes)
    .eq("id", classroom_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await audit(actor, "classroom.update", "classrooms", classroom_id, changes);
  return NextResponse.json({ ok: true });
}
