import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseGroupJoinCode } from "@/lib/group-codes";

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
    .select("id, is_private, join_code")
    .eq("id", id)
    .maybeSingle();

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  /**
   * A public group is joined with a click; a private one needs its code.
   *
   * The code is compared against the column rather than parsed out of the
   * description, so it is unique and is not readable by anyone who can merely
   * see the group.
   */
  if (group.is_private) {
    let code = "";
    try {
      const body = await _request.json();
      code = normaliseGroupJoinCode(String(body.code ?? ""));
    } catch {
      // no body passed
    }

    const expectedCode = group.join_code
      ? normaliseGroupJoinCode(group.join_code)
      : null;
    if (!code || !expectedCode || code !== expectedCode) {
      return NextResponse.json(
        { error: "This is a private group. Please provide the correct join code to join." },
        { status: 403 },
      );
    }
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
