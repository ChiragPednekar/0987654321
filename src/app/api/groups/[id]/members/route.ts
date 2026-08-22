import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Join a group (spec §10). */
export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: group } = await admin
    .from("groups")
    .select("id, is_private")
    .eq("id", id)
    .maybeSingle();

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  // Private groups are invite-only. Without this check the endpoint would be a
  // way around the very policy that makes them private.
  if (group.is_private) {
    return NextResponse.json(
      { error: "This group is invite-only." },
      { status: 403 },
    );
  }

  // member_count is maintained by trigger, so nothing to increment here.
  const { error } = await admin
    .from("group_members")
    .upsert({ group_id: id, user_id: user.id }, { onConflict: "group_id,user_id" });

  if (error) {
    return NextResponse.json({ error: "Could not join." }, { status: 500 });
  }

  return NextResponse.json({ joined: true });
}

/** Leave a group. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: group } = await admin
    .from("groups")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();

  // The owner leaving would orphan a private group beyond recovery.
  if (group?.owner_id === user.id) {
    return NextResponse.json(
      { error: "Transfer or delete the group instead of leaving it." },
      { status: 409 },
    );
  }

  await admin
    .from("group_members")
    .delete()
    .eq("group_id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ joined: false });
}
