import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SNAPSHOT_BUCKET } from "@/lib/proctor-evidence";

export const dynamic = "force-dynamic";

/** 128 KB, matching the bucket's own limit. Base64 is a third larger than the bytes. */
const MAX_BYTES = 131_072;
const MAX_BASE64 = Math.ceil(MAX_BYTES / 3) * 4;

/**
 * Photos per account per hour.
 *
 * The client stops at six per attempt; this is the server's own ceiling,
 * because a client limit is a suggestion. Thirty allows several back-to-back
 * attempts while stopping anyone using the endpoint as free image hosting.
 */
const MAX_PER_HOUR = 30;

const bodySchema = z.object({
  kind: z.enum(["phone", "multiple_faces", "no_face", "book"]),
  image: z.string().min(100).max(MAX_BASE64),
});

/**
 * Stores one evidence photo from the camera checks.
 *
 * Write-only from the student's side: there is no route that returns a photo
 * to the account that took it, and the bucket is private, so the only way to
 * see one is the signed URL on the admin integrity page.
 *
 * Every failure here is quiet by design. The browser fires this and forgets
 * it, and nothing about a photo that could not be saved should reach the
 * student mid-attempt — the counter it accompanies is recorded regardless.
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

  const bytes = Buffer.from(body.image, "base64");

  /**
   * Checked by content, not by the field name or a MIME header the client
   * controls: a JPEG starts FF D8 FF. Anything else is refused before it is
   * stored, so the bucket can only ever hold what the camera produced.
   */
  if (
    bytes.length < 100 ||
    bytes.length > MAX_BYTES ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff
  ) {
    return NextResponse.json({ error: "Not a photo" }, { status: 400 });
  }

  const admin = createAdminClient();

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("proctor_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_PER_HOUR) {
    return NextResponse.json({ error: "Too many photos" }, { status: 429 });
  }

  // Grouped by account and day so a person's photos can be found, and removed,
  // together.
  const day = new Date().toISOString().slice(0, 10);
  const path = `${user.id}/${day}/${randomUUID()}.jpg`;

  const { error: uploadError } = await admin.storage
    .from(SNAPSHOT_BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });

  if (uploadError) {
    console.error("[proctor] snapshot upload failed", uploadError.message);
    return NextResponse.json({ error: "Could not store photo" }, { status: 500 });
  }

  const { error: rowError } = await admin
    .from("proctor_snapshots")
    .insert({ user_id: user.id, kind: body.kind, storage_path: path });

  if (rowError) {
    // A photo with no row is invisible to review and to the purge, so it would
    // outlive the 30 days the student was promised. Take it back out.
    await admin.storage.from(SNAPSHOT_BUCKET).remove([path]);
    console.error("[proctor] snapshot row failed", rowError.message);
    return NextResponse.json({ error: "Could not store photo" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
