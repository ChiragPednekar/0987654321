import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  is_private: z.boolean().default(false),
});

/**
 * Creates a community group (spec §10).
 *
 * Writes go through the service role because the slug has to be derived and
 * de-duplicated server-side, and because the creator must land in
 * group_members atomically — a group with no members is unreachable, since
 * the private-group policy is membership-based.
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

  // One person should not be able to spin up groups without limit.
  const { count: owned } = await admin
    .from("groups")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if ((owned ?? 0) >= 10) {
    return NextResponse.json(
      { error: "You already own 10 groups." },
      { status: 429 },
    );
  }

  const base = slugify(body.name).slice(0, 50) || "group";
  let slug = base;

  // Collisions are rare but a unique violation here would read as a server
  // error to the user, so resolve it before inserting.
  for (let attempt = 2; attempt <= 20; attempt += 1) {
    const { data: taken } = await admin
      .from("groups")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${attempt}`;
  }

  const { data: group, error } = await admin
    .from("groups")
    .insert({
      slug,
      name: body.name,
      description: body.description ?? null,
      owner_id: user.id,
      is_private: body.is_private,
    })
    .select("id, slug")
    .single();

  if (error || !group) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create the group." },
      { status: 500 },
    );
  }

  const { error: memberError } = await admin
    .from("group_members")
    .insert({ group_id: group.id, user_id: user.id });

  if (memberError) {
    // Without the owner as a member a private group is invisible to everyone,
    // including its creator. Roll back rather than leave that behind.
    await admin.from("groups").delete().eq("id", group.id);
    return NextResponse.json(
      { error: "Could not create the group." },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: group.id, slug: group.slug }, { status: 201 });
}
