import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types/database";

/**
 * Server-side authorization.
 *
 * Every check here runs against the database, never against anything the client
 * sent. Two rules govern the whole file:
 *
 *   1. Hiding a link is not authorization. Each guard is called by the route or
 *      page that performs the action, not only by the navigation that offers it.
 *   2. An id from the client is a request, not a claim. `requireBatchTeacher`
 *      takes a classroom id and proves the caller teaches *that* classroom —
 *      which is what stops one teacher reading another's batch by editing a URL.
 */

export class AuthzError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 404,
  ) {
    super(message);
    this.name = "AuthzError";
  }
}

export interface Actor {
  id: string;
  email: string;
  role: UserRole;
}

/** The signed-in actor, or 401. */
export async function requireActor(): Promise<Actor> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new AuthzError("Not authenticated", 401);

  // Role comes from the database, not the JWT: a role change must take effect
  // without waiting for the token to be reissued.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) throw new AuthzError("Account not found", 401);

  return { id: profile.id, email: profile.email, role: profile.role };
}

/** The single platform owner. */
export async function requireAdminActor(): Promise<Actor> {
  const actor = await requireActor();
  if (actor.role !== "admin") {
    throw new AuthzError("Admin access required", 403);
  }
  return actor;
}

/**
 * May open the teacher area at all.
 *
 * Admins pass so the owner can inspect what teachers see without a second
 * account. This says nothing about *which* batches — see requireBatchTeacher.
 */
export async function requireTeacherActor(): Promise<Actor> {
  const actor = await requireActor();
  if (actor.role !== "teacher" && actor.role !== "admin") {
    throw new AuthzError("Teacher access required", 403);
  }
  return actor;
}

/**
 * May act on THIS batch.
 *
 * The platform role opens the section; this decides the scope. Without it a
 * teacher could change the id in the URL and mark another teacher's class,
 * which is the classic IDOR in a product shaped like this one.
 */
export async function requireBatchTeacher(classroomId: string): Promise<Actor> {
  const actor = await requireTeacherActor();
  if (actor.role === "admin") return actor;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("classroom_members")
    .select("role")
    .eq("classroom_id", classroomId)
    .eq("user_id", actor.id)
    .maybeSingle();

  if (membership?.role !== "teacher") {
    // 404 rather than 403 on purpose: confirming a batch exists is itself a
    // small leak, and a teacher probing ids learns nothing from either answer.
    throw new AuthzError("Batch not found", 404);
  }
  return actor;
}

/** May act on this assignment, resolved through its batch. */
export async function requireAssignmentTeacher(
  assignmentId: string,
): Promise<{ actor: Actor; classroomId: string }> {
  const admin = createAdminClient();
  const { data: assignment } = await admin
    .from("classroom_assignments")
    .select("id, classroom_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment) throw new AuthzError("Assignment not found", 404);

  const actor = await requireBatchTeacher(assignment.classroom_id);
  return { actor, classroomId: assignment.classroom_id };
}

/** Batches this actor teaches. Empty for anyone who teaches nothing. */
export async function batchesTaughtBy(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("classroom_members")
    .select("classroom_id")
    .eq("user_id", userId)
    .eq("role", "teacher");
  return (data ?? []).map((r) => r.classroom_id);
}

/** Maps an AuthzError to a response body and status for route handlers. */
export function authzResponse(error: unknown): {
  body: { error: string };
  status: number;
} {
  if (error instanceof AuthzError) {
    return { body: { error: error.message }, status: error.status };
  }
  return { body: { error: "Something went wrong" }, status: 500 };
}

/**
 * Records a sensitive action.
 *
 * Fire-and-forget: an audit row must not be able to fail the action it
 * describes. The action still happened either way, and a licence that could not
 * be suspended because logging failed would be the worse outcome.
 */
export async function audit(
  actor: Actor,
  action: string,
  resource: string,
  resourceId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_log").insert({
      actor_id: actor.id,
      actor_email: actor.email,
      action,
      resource,
      resource_id: resourceId,
      metadata: metadata as never,
    });

    // Logged rather than thrown: the action still happened, and a licence that
    // could not be suspended because logging failed would be the worse
    // outcome. But an audit trail that fails silently is not an audit trail —
    // if this line starts appearing, the log is incomplete and someone needs
    // to know before it is relied on.
    if (error) {
      console.error("[audit] could not write audit row", {
        action,
        resource,
        resource_id: resourceId,
        code: error.code,
        message: error.message,
      });
    }
  } catch (error) {
    console.error("[audit] audit write threw", { action, resource, error });
  }
}
