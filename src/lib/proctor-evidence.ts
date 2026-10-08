import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProctorSnapshotRow } from "@/lib/types/database";

type Admin = SupabaseClient<Database>;

/** Private bucket created by 20250101000061. Only the service role reaches it. */
export const SNAPSHOT_BUCKET = "proctor-evidence";

/**
 * How long a photo is kept. The consent notice in proctor-overlay.tsx promises
 * this number to the student, so the two must change together.
 */
export const SNAPSHOT_RETENTION_DAYS = 30;

/** Signed URLs on the review page outlive a reading session and nothing more. */
const SIGNED_URL_SECONDS = 60 * 60;

/**
 * When an attempt's start is unknown, how far back from its finding to look.
 * Generous rather than tight: missing the photo that explains a flag is worse
 * than showing one from just before the attempt, which is visibly timestamped.
 */
const FALLBACK_WINDOW_MS = 2 * 60 * 60 * 1000;

export interface EvidencePhoto {
  kind: ProctorSnapshotRow["kind"];
  takenAt: string;
  url: string;
}

interface FindingWindow {
  id: string;
  user_id: string;
  created_at: string;
  server_elapsed_seconds: number | null;
}

/**
 * The photos taken during each finding's attempt, keyed by finding id.
 *
 * Photos are not linked to an attempt in the database (see the migration for
 * why), so they are matched here by account and time: anything taken between
 * the attempt's server-stamped start and its submission, with a minute of slack
 * either side for clock drift and a photo uploaded just after submit.
 */
export async function photosForFindings(
  admin: Admin,
  findings: FindingWindow[],
): Promise<Map<string, EvidencePhoto[]>> {
  const out = new Map<string, EvidencePhoto[]>();
  if (findings.length === 0) return out;

  const windows = findings.map((f) => {
    const end = new Date(f.created_at).getTime() + 60_000;
    const span =
      f.server_elapsed_seconds !== null
        ? f.server_elapsed_seconds * 1000 + 120_000
        : FALLBACK_WINDOW_MS;
    return { id: f.id, userId: f.user_id, start: end - span, end };
  });

  const users = [...new Set(windows.map((w) => w.userId))];
  const earliest = new Date(Math.min(...windows.map((w) => w.start))).toISOString();

  const { data: rows, error } = await admin
    .from("proctor_snapshots")
    .select("user_id, kind, storage_path, created_at")
    .in("user_id", users)
    .gte("created_at", earliest)
    .order("created_at");

  if (error || !rows?.length) return out;

  const { data: signed } = await admin.storage
    .from(SNAPSHOT_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      SIGNED_URL_SECONDS,
    );
  const urlFor = new Map(
    (signed ?? [])
      .filter((s) => s.signedUrl && s.path)
      .map((s) => [s.path as string, s.signedUrl]),
  );

  for (const w of windows) {
    const photos: EvidencePhoto[] = [];
    for (const r of rows) {
      const t = new Date(r.created_at).getTime();
      const url = urlFor.get(r.storage_path);
      if (r.user_id === w.userId && t >= w.start && t <= w.end && url) {
        photos.push({ kind: r.kind, takenAt: r.created_at, url });
      }
    }
    if (photos.length) out.set(w.id, photos);
  }
  return out;
}

/**
 * Deletes photos past their retention, file first and row second.
 *
 * In that order so a failure can only ever leave a row pointing at nothing —
 * which the next run cleans up — and never a photo with no row, which no run
 * would ever find again.
 *
 * Batched, because the daily cron must not stall on one huge backlog. Anything
 * left is picked up tomorrow, and a 30-day promise is not broken by a day.
 */
export async function purgeExpiredSnapshots(
  admin: Admin,
  batch = 500,
): Promise<{ deleted: number }> {
  const cutoff = new Date(
    Date.now() - SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: rows, error } = await admin
    .from("proctor_snapshots")
    .select("id, storage_path")
    .lt("created_at", cutoff)
    .order("created_at")
    .limit(batch);

  if (error || !rows?.length) return { deleted: 0 };

  const { error: removeError } = await admin.storage
    .from(SNAPSHOT_BUCKET)
    .remove(rows.map((r) => r.storage_path));
  if (removeError) throw new Error(removeError.message);

  const { error: deleteError } = await admin
    .from("proctor_snapshots")
    .delete()
    .in(
      "id",
      rows.map((r) => r.id),
    );
  if (deleteError) throw new Error(deleteError.message);

  return { deleted: rows.length };
}
