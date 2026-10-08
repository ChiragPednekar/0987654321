import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntegrityActions } from "@/components/admin/integrity-actions";
import { plural, timeAgo } from "@/lib/utils";
import { CAMERA_REVIEW_FLAGS } from "@/lib/integrity";
import { photosForFindings } from "@/lib/proctor-evidence";

export const metadata: Metadata = { title: "Integrity" };

const PAGE_SIZE = 50;

/** Flag codes are stored; these are what a human reads. */
const FLAG_LABEL: Record<string, string> = {
  pasted_answer: "Answer pasted",
  pasted_section: "Large paste",
  bulk_paste: "Single long paste",
  not_typed: "Not typed",
  little_typing: "Barely typed",
  impossible_speed: "Too fast to write",
  frequent_tab_away: "Left page repeatedly",
  tab_away: "Left page",
  long_absence: "Long absence",
  left_exam_mode: "Left exam mode",
  ai_style: "Reads as AI",
  phone_seen: "Phone on camera",
  multiple_faces: "Another person on camera",
  no_face: "Away from camera",
  camera_covered: "Camera blocked",
  camera_refused: "Camera refused",
  camera_unavailable: "No camera",
  camera_lost: "Camera stopped",
  camera_not_analysed: "Camera not analysed",
  book_seen: "Book on camera",
};

/** Read by a reviewer deciding about a person, so said plainly. */
const PHOTO_LABEL: Record<string, string> = {
  phone: "phone",
  multiple_faces: "another person",
  no_face: "nobody in frame",
  book: "book",
};

const CAMERA_FLAGS = new Set<string>([
  ...CAMERA_REVIEW_FLAGS,
  "camera_unavailable",
  "camera_not_analysed",
  "book_seen",
]);

/** What each surface is called in the console. */
const ACTIVITY_LABEL: Record<string, string> = {
  case: "Case",
  contest: "Contest",
  objective: "Aptitude paper",
  daily_quiz: "Daily quiz",
  sql: "SQL exercise",
  excel: "Excel exercise",
  interview: "HR interview",
  negotiation: "Negotiation",
  simulation: "Simulation",
  competition: "Competition entry",
  group_discussion: "Group discussion",
  sales: "Sales role-play",
};

export default async function IntegrityPage() {
  const admin = createAdminClient();

  /**
   * `users!submission_integrity_user_id_fkey`, not `users`. The table has two
   * keys into users — the student, and `cleared_by` for the admin who cleared
   * a finding — so a bare `users(...)` is ambiguous and PostgREST refuses the
   * whole query (PGRST201). It did exactly that, and because the error was not
   * read, this page said "Nothing flagged yet" over every flagged attempt on
   * the platform.
   */
  const { data, error } = await admin
    .from("submission_integrity")
    .select(
      "id, activity, submission_id, user_id, severity, score, penalty_pct, flags, ai_likelihood, server_elapsed_seconds, cleared_at, created_at, users!submission_integrity_user_id_fkey(email, full_name, deactivated_at), cases(slug, title)",
    )
    .order("created_at", { ascending: false })
    /**
     * Everything that cost marks, plus anything the camera flagged. Camera
     * findings carry no points, so their attempts are usually `clean` — and
     * filtering on severity alone would record a phone in shot on an attempt
     * this page never shows.
     */
    .or(`severity.neq.clean,flags.ov.{${CAMERA_REVIEW_FLAGS.join(",")}}`)
    .limit(PAGE_SIZE);

  if (error) console.error("[admin/integrity] findings query failed", error.message);
  const rows = data ?? [];
  const photos = await photosForFindings(admin, rows);
  const open = rows.filter((r) => !r.cleared_at);
  const suspended = new Set(
    rows
      .filter((r) => {
        const u = Array.isArray(r.users) ? r.users[0] : r.users;
        return u?.deactivated_at;
      })
      .map((r) => r.user_id),
  );

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Flagged attempts, newest first. {plural(open.length, "open finding")}
          {suspended.size > 0
            ? `, ${plural(suspended.size, "suspended account")}`
            : ""}
          .
        </p>
      </div>

      {/*
        Stated on the page rather than buried in a doc, because whoever reads
        this list is about to make a decision about a student, and the limits of
        the evidence are part of the decision.
      */}
      <Card className="mt-6 border-muted">
        <CardContent className="flex items-start gap-2.5 p-4 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <p>
            Browser signals can be forged by a student who knows how, and
            &ldquo;reads as AI&rdquo; is the model&apos;s opinion, never proof — on
            its own it never reduces a mark. Camera findings are a model&apos;s
            reading of a webcam frame and never reduce a mark at all: look at
            the photo before deciding anything. Treat a finding as a reason to
            look at the answer, not as a verdict. Clearing one restores the
            student&apos;s standing immediately.
          </p>
        </CardContent>
      </Card>

      {error ? (
        // Never "Nothing flagged yet" when the truth is "could not look".
        <Card className="mt-6 border-danger-border bg-danger-surface">
          <CardContent className="p-6 text-sm text-danger">
            Findings could not be loaded, so this list is not complete. Nothing
            here means the query failed, not that the platform is clean.
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nothing flagged yet.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((row) => {
            const user = Array.isArray(row.users) ? row.users[0] : row.users;
            const kase = Array.isArray(row.cases) ? row.cases[0] : row.cases;
            const isSuspended = Boolean(user?.deactivated_at);
            const evidence = photos.get(row.id) ?? [];
            const cameraOnly = row.severity === "clean";

            return (
              <Card
                key={row.id}
                className={row.cleared_at ? "opacity-60" : undefined}
              >
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/*
                        "clean" would be misleading here: the attempt is only
                        listed because the camera saw something. It has lost
                        no marks, and the badge says what it needs.
                      */}
                      <Badge
                        variant={
                          row.severity === "severe"
                            ? "destructive"
                            : cameraOnly
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {row.severity === "severe" ? (
                          <ShieldAlert className="size-3" />
                        ) : null}
                        {cameraOnly ? "camera review" : row.severity}
                      </Badge>
                      <span className="text-sm font-medium">
                        {user?.full_name || user?.email || "Unknown account"}
                      </span>
                      {isSuspended && <Badge variant="destructive">suspended</Badge>}
                      {row.cleared_at && <Badge variant="outline">cleared</Badge>}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {/*
                        A verdict is no longer necessarily about a case, so the
                        subject line names the surface. Only a case submission
                        can be linked to — the other activities have no
                        equivalent review view to open.
                      */}
                      {kase && row.submission_id ? (
                        <Link
                          href={`/cases/${kase.slug}?submission=${row.submission_id}#review`}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {kase.title}
                        </Link>
                      ) : (
                        (ACTIVITY_LABEL[row.activity] ?? row.activity)
                      )}{" "}
                      · {timeAgo(row.created_at)} · integrity {row.score}/100 ·
                      −{row.penalty_pct}% applied
                      {row.server_elapsed_seconds !== null
                        ? ` · ${Math.round(row.server_elapsed_seconds / 60)} min spent`
                        : " · start not recorded"}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {row.flags.map((flag) => (
                        <span
                          key={flag}
                          className={`rounded-md px-2 py-0.5 text-[11px] ${
                            CAMERA_FLAGS.has(flag)
                              ? "border border-info-border bg-info-surface text-info"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {FLAG_LABEL[flag] ?? flag}
                          {flag === "ai_style" && row.ai_likelihood !== null
                            ? ` (${row.ai_likelihood})`
                            : ""}
                        </span>
                      ))}
                    </div>

                    {evidence.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {evidence.map((photo) => (
                          <a
                            key={photo.url}
                            href={photo.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group block w-28 overflow-hidden rounded-md border"
                          >
                            {/*
                              A plain img, not next/image: these are short-lived
                              signed URLs to a private bucket, and routing them
                              through the image optimiser would cache a private
                              photo under a public URL.
                            */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.url}
                              alt={`Camera photo: ${PHOTO_LABEL[photo.kind] ?? photo.kind}`}
                              className="aspect-[4/3] w-full bg-muted object-cover"
                              loading="lazy"
                            />
                            <span className="block px-1.5 py-1 text-[10px] text-muted-foreground group-hover:text-foreground">
                              {PHOTO_LABEL[photo.kind] ?? photo.kind} ·{" "}
                              {timeAgo(photo.takenAt)}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {!row.cleared_at && (
                    <IntegrityActions
                      findingId={row.id}
                      suspended={isSuspended}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
