import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SNAPSHOT_BUCKET } from "@/lib/proctor-evidence";

export const dynamic = "force-dynamic";

/** 256 KB max for a 3-second audio snippet. Base64 is ~33% larger. */
const MAX_BYTES = 262_144;
const MAX_BASE64 = Math.ceil(MAX_BYTES / 3) * 4;
const MAX_PER_HOUR = 30;

const bodySchema = z.object({
  audio: z.string().min(50).max(MAX_BASE64),
  format: z.string().optional().default("audio/webm"),
});

/**
 * Stores an audio evidence recording when voice activity/speaking is detected.
 * Private bucket proctor-evidence; purged alongside snapshots.
 */
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
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const bytes = Buffer.from(body.audio, "base64");
  if (bytes.length < 50 || bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "Invalid audio payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("proctor_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_PER_HOUR) {
    return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  }

  const day = new Date().toISOString().slice(0, 10);
  const ext = body.format.includes("mp4") ? "m4a" : "webm";
  const path = `${user.id}/${day}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(SNAPSHOT_BUCKET)
    .upload(path, bytes, { contentType: body.format || "audio/webm", upsert: false });

  if (uploadError) {
    console.error("[proctor] audio snapshot upload failed", uploadError.message);
    return NextResponse.json({ error: "Could not store audio" }, { status: 500 });
  }

  // Record evidence in proctor_snapshots under "multiple_faces" (talking / voice collaboration)
  const { error: rowError } = await admin
    .from("proctor_snapshots")
    .insert({ user_id: user.id, kind: "multiple_faces", storage_path: path });

  if (rowError) {
    await admin.storage.from(SNAPSHOT_BUCKET).remove([path]);
    console.error("[proctor] audio snapshot row failed", rowError.message);
    return NextResponse.json({ error: "Could not record audio" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
