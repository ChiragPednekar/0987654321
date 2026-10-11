import { ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReopenTestButton } from "@/components/proctor/reopen-test-button";
import { END_REASON_LABEL } from "@/lib/camera-proctor";
import type { LockoutView } from "@/lib/exam-lockouts";
import { timeAgo } from "@/lib/utils";

const PHOTO_LABEL: Record<string, string> = {
  phone: "phone",
  multiple_faces: "another person",
  no_face: "nobody in frame",
  book: "book",
};

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
            row.reopenedAt ? "opacity-60" : ""
          }`}
        >
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldX className="size-4 text-danger" aria-hidden />
              <span className="text-sm font-medium">{row.student.name}</span>
              {row.reopenedAt ? <Badge variant="outline">reopened</Badge> : <Badge variant="destructive">ended</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {END_REASON_LABEL[row.reason]} · {row.surface} ·{" "}
              <span className="font-mono">{row.path}</span> · {timeAgo(row.createdAt)}
            </p>
            {row.photos.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {row.photos.map((photo) => (
                  <a
                    key={photo.url}
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group block w-28 overflow-hidden rounded-md border"
                  >
                    {/* Signed URL to a private bucket — see the integrity page for why not next/image. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={`Camera photo: ${PHOTO_LABEL[photo.kind] ?? photo.kind}`}
                      className="aspect-[4/3] w-full bg-muted object-cover"
                      loading="lazy"
                    />
                    <span className="block px-1.5 py-1 text-[10px] text-muted-foreground group-hover:text-foreground">
                      {PHOTO_LABEL[photo.kind] ?? photo.kind} · {timeAgo(photo.takenAt)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
          {!row.reopenedAt && <ReopenTestButton lockoutId={row.id} />}
        </li>
      ))}
    </ul>
  );
}
