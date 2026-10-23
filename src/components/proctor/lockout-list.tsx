import { ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReopenTestButton } from "@/components/proctor/reopen-test-button";
import { END_REASON_LABEL } from "@/lib/camera-proctor";
import type { LockoutView } from "@/lib/exam-lockouts";
import { MAX_STRIKES } from "@/lib/exam-lockouts";
import { timeAgo } from "@/lib/utils";
import { EvidenceThumb } from "@/components/proctor/evidence-thumb";


/**
 * Tests that were ended — by the camera or by leaving the window — for
 * whoever may reopen them.
 *
 * The photo sits next to the button on purpose: the ending is a model's
 * reading of a webcam frame, and the decision to let a student back in should
 * be made looking at what it saw.
 */
export function LockoutList({ rows, failed }: { rows: LockoutView[]; failed: boolean }) {
  if (failed) {
    return (
      <p className="text-sm text-danger">
        Ended tests could not be loaded, so this list is not complete.
      </p>
    );
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No test has been ended.</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li
          key={row.id}
          className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between ${
            row.active ? "" : "opacity-60"
          }`}
        >
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldX className="size-4 text-danger" aria-hidden />
              <span className="text-sm font-medium">{row.student.name}</span>
              <LockBadge row={row} />
            </div>
            <p className="text-xs text-muted-foreground">
              {END_REASON_LABEL[row.reason]} · {row.surface} ·{" "}
              <span className="font-mono">{row.path}</span> · {timeAgo(row.createdAt)}
            </p>
            {row.photos.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {row.photos.map((photo) => (
                  <EvidenceThumb key={photo.url} photo={photo} />
                ))}
              </div>
            )}
          </div>
          {row.active && <ReopenTestButton lockoutId={row.id} />}
        </li>
      ))}
    </ul>
  );
}

/**
 * Where this ending stands. Strikes 1 and 2 lift by themselves after 24 hours;
 * the third is permanent until someone reopens it.
 */
function LockBadge({ row }: { row: LockoutView }) {
  const strike = `strike ${row.strike} of ${MAX_STRIKES}`;
  if (row.reopenedAt) return <Badge variant="outline">reopened</Badge>;
  if (!row.active) return <Badge variant="outline">lifted after 24h · {strike}</Badge>;
  if (row.expiresAt === null) return <Badge variant="destructive">blocked for good · {strike}</Badge>;
  return (
    <Badge variant="destructive">
      blocked until{" "}
      {new Date(row.expiresAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      })}{" "}
      · {strike}
    </Badge>
  );
}
