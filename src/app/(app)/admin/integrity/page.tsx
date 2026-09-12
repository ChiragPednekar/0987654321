import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntegrityActions } from "@/components/admin/integrity-actions";
import { plural, timeAgo } from "@/lib/utils";

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
};

export default async function IntegrityPage() {
  const admin = createAdminClient();

  const { data } = await admin
    .from("submission_integrity")
    .select(
      "submission_id, user_id, severity, score, penalty_pct, flags, ai_likelihood, server_elapsed_seconds, cleared_at, created_at, users(email, full_name, deactivated_at), cases(slug, title)",
    )
    .order("created_at", { ascending: false })
    .neq("severity", "clean")
    .limit(PAGE_SIZE);

  const rows = data ?? [];
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
          Flagged submissions, newest first. {plural(open.length, "open finding")}
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
            its own it never reduces a mark. Treat a finding as a reason to look
            at the answer, not as a verdict. Clearing one restores the
            student&apos;s standing immediately.
          </p>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
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

            return (
              <Card
                key={row.submission_id}
                className={row.cleared_at ? "opacity-60" : undefined}
              >
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          row.severity === "severe" ? "destructive" : "secondary"
                        }
                      >
                        {row.severity === "severe" ? (
                          <ShieldAlert className="size-3" />
                        ) : null}
                        {row.severity}
                      </Badge>
                      <span className="text-sm font-medium">
                        {user?.full_name || user?.email || "Unknown account"}
                      </span>
                      {isSuspended && <Badge variant="destructive">suspended</Badge>}
                      {row.cleared_at && <Badge variant="outline">cleared</Badge>}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {kase ? (
                        <Link
                          href={`/cases/${kase.slug}?submission=${row.submission_id}#review`}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          {kase.title}
                        </Link>
                      ) : (
                        "Case removed"
                      )}{" "}
                      · {timeAgo(row.created_at)} · integrity {row.score}/100 ·
                      −{row.penalty_pct}% applied
                      {row.server_elapsed_seconds !== null
                        ? ` · ${Math.round(row.server_elapsed_seconds / 60)} min on the case`
                        : " · start not recorded"}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {row.flags.map((flag) => (
                        <span
                          key={flag}
                          className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {FLAG_LABEL[flag] ?? flag}
                          {flag === "ai_style" && row.ai_likelihood !== null
                            ? ` (${row.ai_likelihood})`
                            : ""}
                        </span>
                      ))}
                    </div>
                  </div>

                  {!row.cleared_at && (
                    <IntegrityActions
                      submissionId={row.submission_id}
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
