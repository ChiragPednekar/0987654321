import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function activeMember(sessionId: string, userId: string) {
  const admin = createAdminClient();
  let { data } = await admin.from("gd_participants")
    .select("user_id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("admission_status", "approved")
    .is("left_at", null)
    .maybeSingle();

  if (!data) {
    const legacy = await admin.from("gd_participants")
      .select("user_id")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .is("left_at", null)
      .maybeSingle();
    data = legacy.data;
  }
  return data ? admin : null;
}

async function present(rows: Array<{
  id: string;
  session_id: string;
  user_id: string;
  body: string | null;
  media_path: string | null;
  media_kind: "image" | "video" | null;
  media_name: string | null;
  created_at: string;
  users: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
}>, admin: ReturnType<typeof createAdminClient>) {
  return Promise.all(rows.map(async (row) => {
    const profile = Array.isArray(row.users) ? row.users[0] : row.users;
    const {
      id,
      session_id,
      user_id,
      body,
      media_path,
      media_kind,
      media_name,
      created_at,
    } = row;
    let mediaUrl: string | null = null;
    if (media_path) {
      const { data } = await admin.storage.from("gd-chat-media")
        .createSignedUrl(media_path, 60 * 60);
      mediaUrl = data?.signedUrl ?? null;
    }
    return {
      id,
      session_id,
      user_id,
      body,
      media_path,
      media_kind,
      media_name,
      created_at,
      senderName: profile?.full_name || profile?.email?.split("@")[0] || "Participant",
      mediaUrl,
    };
  }));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const admin = await activeMember(id, user.id);
  if (!admin) return NextResponse.json({ error: "You are not in this meeting." }, { status: 403 });
  const { data, error } = await admin.from("gd_messages")
    .select("id, session_id, user_id, body, media_path, media_kind, media_name, created_at, users(full_name, email)")
    .eq("session_id", id)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) return NextResponse.json({ error: "Could not load chat." }, { status: 500 });
  return NextResponse.json({ messages: await present((data ?? []).reverse(), admin) });
}

const messageSchema = z.object({
  body: z.string().trim().max(2000).optional(),
  mediaPath: z.string().max(500).optional(),
  mediaName: z.string().trim().max(200).optional(),
}).refine((value) => Boolean(value.body || value.mediaPath), "Write a message or attach a file.");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  let body: z.infer<typeof messageSchema>;
  try {
    body = messageSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Write a message or attach a file." }, { status: 400 });
  }
  const admin = await activeMember(id, user.id);
  if (!admin) return NextResponse.json({ error: "You are not in this meeting." }, { status: 403 });

  let mediaKind: "image" | "video" | null = null;
  if (body.mediaPath) {
    if (!body.mediaPath.startsWith(`${id}/${user.id}/`)) {
      return NextResponse.json({ error: "That attachment is not available." }, { status: 400 });
    }
    const { data: info, error: infoError } = await admin.storage
      .from("gd-chat-media").info(body.mediaPath);
    if (infoError || !info || info.size === undefined || info.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "The upload could not be verified." }, { status: 400 });
    }
    const contentType = info.contentType ?? info.metadata?.mimetype ?? "";
    mediaKind = contentType.startsWith("image/") ? "image"
      : contentType.startsWith("video/") ? "video" : null;
    if (!mediaKind) return NextResponse.json({ error: "Use an image or video file." }, { status: 400 });
  }

  const { data: row, error } = await admin.from("gd_messages").insert({
    session_id: id,
    user_id: user.id,
    body: body.body || null,
    media_path: body.mediaPath ?? null,
    media_kind: mediaKind,
    media_name: body.mediaPath ? body.mediaName ?? "Attachment" : null,
  }).select("id, session_id, user_id, body, media_path, media_kind, media_name, created_at, users(full_name, email)")
    .single();
  if (error || !row) {
    console.error("[gd] chat message insert failed", error?.message);
    return NextResponse.json({ error: "Could not send this message." }, { status: 500 });
  }
  const [message] = await present([row], admin);
  return NextResponse.json({ message }, { status: 201 });
}
