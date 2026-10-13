import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, ExamLockoutRow } from "@/lib/types/database";
import { photosForFindings, type EvidencePhoto } from "@/lib/proctor-evidence";

type Admin = SupabaseClient<Database>;

/**
 * How an ended test is punished. The first and second endings on a page lock
 * it for COOLDOWN_HOURS, after which the student may try again under the same
 * rules; the MAX_STRIKES-th locks it for good. See migration 068.
 */
export const COOLDOWN_HOURS = 24;
export const MAX_STRIKES = 3;

/** What a page's lock looks like to the student it locks. */
export interface LockState {
  reason: ExamLockoutRow["reason"];
  /** When the test was ended. */
  at: string;
  /** When it opens again. Null when it never will. */
  until: string | null;
  strike: number;
  maxStrikes: number;
}

type LockRow = Pick<ExamLockoutRow, "id" | "reason" | "created_at" | "strike" | "expires_at">;

const LOCK_COLUMNS = "id, reason, created_at, strike, expires_at";

function stateOf(row: LockRow): LockState {
  return {
    reason: row.reason,
    at: row.created_at,
    until: row.expires_at,
    strike: row.strike,
    maxStrikes: MAX_STRIKES,
  };
}

const isActive = (row: LockRow, now = Date.now()) =>
  row.expires_at === null || new Date(row.expires_at).getTime() > now;

/**
 * Every unforgiven lock this account has on this page, newest strike first.
 * "Unforgiven" is reopened_at null: a teacher's reopen wipes that strike, a
 * lock that simply ran out does not.
 */
async function strikesOn(admin: Admin, userId: string, path: string) {
  const { data, error } = await admin
    .from("exam_lockouts")
    .select(LOCK_COLUMNS)
    .eq("user_id", userId)
    .eq("path", path)
    .is("reopened_at", null)
    .order("strike", { ascending: false });
  return { rows: (data ?? []) as LockRow[], error };
}

/**
 * The lock in force on this page for this account, or null when the page is
 * open — never locked, reopened by a teacher, or past its 24 hours.
 */
export async function activeLockout(
  admin: Admin,
  userId: string,
  path: string,
): Promise<{ state: LockState | null; failed: boolean }> {
  const { rows, error } = await strikesOn(admin, userId, path);
  if (error) {
    console.error("[lockouts] check failed", error.message);
    return { state: null, failed: true };
  }
  const active = rows.find((r) => isActive(r));
  return { state: active ? stateOf(active) : null, failed: false };
}

/**
 * Records an ending as the next strike on this page and returns the lock now
 * in force.
 *
 * If a lock is already in force — a reload, a second detector firing a moment
 * after the first — that one is returned and no strike is added: one sitting
 * earns one strike however many things it tripped. Two endings racing past
 * that check compute the same strike number, and the partial unique index
 * turns the second into a conflict, after which the winner is read back.
 */
export async function recordLockout(
  admin: Admin,
  input: { userId: string; path: string; reason: ExamLockoutRow["reason"]; signals: unknown },
): Promise<LockState | null> {
  const { rows, error } = await strikesOn(admin, input.userId, input.path);
  if (error) {
    console.error("[lockouts] strike lookup failed", error.message);
    return null;
  }
  const active = rows.find((r) => isActive(r));
  if (active) return stateOf(active);

  const strike = (rows[0]?.strike ?? 0) + 1;
  const expiresAt =
    strike >= MAX_STRIKES ? null : new Date(Date.now() + COOLDOWN_HOURS * 3_600_000).toISOString();

  const { data, error: insertError } = await admin
    .from("exam_lockouts")
    .insert({
      user_id: input.userId,
      path: input.path,
      reason: input.reason,
      signals: input.signals as ExamLockoutRow["signals"],
      strike,
      expires_at: expiresAt,
    })
    .select(LOCK_COLUMNS)
    .single();

  if (insertError) {
    // 23505: the same strike was written a moment ago by the other request.
    if (insertError.code === "23505") return (await activeLockout(admin, input.userId, input.path)).state;
    console.error("[lockouts] record failed", insertError.message);
    return null;
  }
  return stateOf(data as LockRow);
}

/** "Try again after 14 Oct, 10:05" — the student's sentence for a lock. */
export function lockMessage(state: LockState): string {
  if (state.until === null) {
    return `This question has been flagged ${state.maxStrikes} times under the proctoring rules and is now blocked for good. Ask your teacher if you think this is a mistake.`;
  }
  return `This test was ended under the proctoring rules. You can try it again after ${new Date(state.until).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}.`;
}

export interface LockoutView {
  id: string;
  path: string;
  surface: string;
  reason: ExamLockoutRow["reason"];
  createdAt: string;
  reopenedAt: string | null;
  strike: number;
  /** When it lifts by itself; null for the strike that locks it for good. */
  expiresAt: string | null;
  /** Still keeping the student out: not reopened, and not past expiresAt. */
  active: boolean;
  student: { name: string; email: string };
  photos: EvidencePhoto[];
}

/** First path segment → what the student was doing, for a reviewer. */
const SURFACE: Record<string, string> = {
  cases: "Case",
  contests: "Contest",
  competitions: "Competition entry",
  practice: "Aptitude paper",
  daily: "Daily quiz",
  sql: "SQL exercise",
  excel: "Excel exercise",
  interview: "HR interview",
  negotiation: "Negotiation",
  simulation: "Simulation",
  gd: "Group discussion",
  sales: "Sales role-play",
};

/**
 * Tests the camera ended, newest first, with the photos taken around them.
 *
 * `students` scopes the list to a batch for a teacher; omitted, it is every
 * account, for the admin. Recent reopened rows are included so whoever
 * reopened a test can see that they did.
 */
export async function loadLockouts(
  admin: Admin,
  { students, limit = 50 }: { students?: string[]; limit?: number } = {},
): Promise<{ rows: LockoutView[]; failed: boolean }> {
  if (students && students.length === 0) return { rows: [], failed: false };

  let query = admin
    .from("exam_lockouts")
    .select("id, user_id, path, reason, created_at, reopened_at, strike, expires_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (students) query = query.in("user_id", students);

  const { data, error } = await query;
  if (error) {
    console.error("[lockouts] query failed", error.message);
    return { rows: [], failed: true };
  }
  const lockouts = data ?? [];
  if (lockouts.length === 0) return { rows: [], failed: false };

  const userIds = [...new Set(lockouts.map((l) => l.user_id))];
  const [{ data: users }, photos] = await Promise.all([
    admin.from("users").select("id, full_name, email").in("id", userIds),
    // The ending is the moment of the finding; the photo was taken at its start,
    // a few seconds earlier. Matched by account and time like every other photo.
    photosForFindings(
      admin,
      lockouts.map((l) => ({
        id: l.id,
        user_id: l.user_id,
        created_at: l.created_at,
        server_elapsed_seconds: null,
      })),
    ),
  ]);
  const byId = new Map((users ?? []).map((u) => [u.id, u]));

  return {
    failed: false,
    rows: lockouts.map((l) => {
      const u = byId.get(l.user_id);
      return {
        id: l.id,
        path: l.path,
        surface: SURFACE[l.path.split("/")[1] ?? ""] ?? "Test",
        reason: l.reason,
        createdAt: l.created_at,
        reopenedAt: l.reopened_at,
        strike: l.strike,
        expiresAt: l.expires_at,
        active:
          !l.reopened_at &&
          (l.expires_at === null || new Date(l.expires_at).getTime() > Date.now()),
        student: { name: u?.full_name || u?.email || "Unknown account", email: u?.email ?? "" },
        photos: photos.get(l.id) ?? [],
      };
    }),
  };
}

/**
 * The server's half of an ended test: refuses the request if this account is
 * locked out of the page the request belongs to.
 *
 * The browser freezes the page the moment a test ends, but the browser is the
 * student's. Without this, anyone who opened devtools after their test was
 * ended could keep posting answers straight to the API. Every route that
 * writes to a proctored test calls this with the path of that test's page —
 * the same key the lock was written under (see /api/proctor/lockout).
 *
 * A lock past its 24 hours no longer counts (see activeLockout).
 *
 * Returns the response to send, or null to carry on. A failed lookup carries
 * on: refusing every honest student because one query timed out is the worse
 * failure, and the lock is still enforced in the browser.
 */
export async function lockoutResponse(
  userId: string,
  path: string,
): Promise<NextResponse | null> {
  const { state } = await activeLockout(createAdminClient(), userId, path);
  if (!state) return null;
  return NextResponse.json({ error: lockMessage(state), lock: state }, { status: 403 });
}
