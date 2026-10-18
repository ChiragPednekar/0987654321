import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const types: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  contentType: z.string().refine((type) => type in types),
  size: z.number().int().positive().max(25 * 1024 * 1024),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Choose an image or video under 25 MB." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: member } = await admin.from("gd_participants")
    .select("user_id")
    .eq("session_id", id)
    .eq("user_id", user.id)
    .eq("admission_status", "approved")
    .is("left_at", null)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "You are not in this meeting." }, { status: 403 });

  const extension = types[body.contentType];
  const path = `${id}/${user.id}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await admin.storage.from("gd-chat-media")
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[gd] media upload URL failed", error?.message);
    return NextResponse.json({ error: "Could not prepare the upload." }, { status: 500 });
  }
  return NextResponse.json({ path, token: data.token });
}
