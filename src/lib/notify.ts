import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Admin = SupabaseClient<Database>;

/**
 * Who wants assignment notifications, out of the ids given.
 *
 * `users.notify_assignments` (20250101000030) is the only notification
 * preference the product can honour: the other three toggles the settings page
 * used to show described email and scheduled reminders that do not exist here.
 *
 * Scope is deliberately the assignment lifecycle — set, graded, returned — and
 * NOT administrative notices. Being removed from a batch or having an account
 * deactivated still notifies unconditionally, because those are things that
 * happened *to* the student's access rather than coursework chatter, and a
 * batch silently vanishing is exactly the confusion the notification exists to
 * prevent.
 *
 * Fails open. If the column is missing or the read errors, everyone is treated
 * as opted in: a preference lookup failing should cost someone a notification
 * they wanted, never silence a grade they were waiting for.
 */
export async function assignmentNoticeRecipients(
  admin: Admin,
  userIds: string[],
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const { data, error } = await admin
    .from("users")
    .select("id, notify_assignments")
    .in("id", userIds);

  if (error || !data) {
    console.error("[notify] preference lookup failed", error?.message);
    return userIds;
  }

  const optedOut = new Set(
    data.filter((u) => u.notify_assignments === false).map((u) => u.id),
  );
  return userIds.filter((id) => !optedOut.has(id));
}

/** Single-recipient convenience over {@link assignmentNoticeRecipients}. */
export async function wantsAssignmentNotices(
  admin: Admin,
  userId: string,
): Promise<boolean> {
  const allowed = await assignmentNoticeRecipients(admin, [userId]);
  return allowed.length > 0;
}
