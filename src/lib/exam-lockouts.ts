import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, ExamLockoutRow } from "@/lib/types/database";
import { photosForFindings, type EvidencePhoto } from "@/lib/proctor-evidence";

type Admin = SupabaseClient<Database>;

export interface LockoutView {
  id: string;
  path: string;
  surface: string;
  reason: ExamLockoutRow["reason"];
  createdAt: string;
  reopenedAt: string | null;
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
    .select("id, user_id, path, reason, created_at, reopened_at")
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
 * Returns the response to send, or null to carry on. A failed lookup carries
 * on: refusing every honest student because one query timed out is the worse
 * failure, and the lock is still enforced in the browser.
 */
export async function lockoutResponse(
  userId: string,
  path: string,
): Promise<NextResponse | null> {
  const { data, error } = await createAdminClient()
    .from("exam_lockouts")
    .select("reason")
    .eq("user_id", userId)
    .eq("path", path)
    .is("reopened_at", null)
    .maybeSingle();
  if (error) {
    console.error("[lockouts] check failed", error.message);
    return null;
  }
  if (!data) return null;
  return NextResponse.json(
    { error: "This test has ended and can no longer be changed. Ask your teacher to reopen it." },
    { status: 403 },
  );
}
