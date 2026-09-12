import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STRIKES_BEFORE_BLOCK } from "@/lib/integrity";
import { plural, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Academic integrity" };

const FLAG_LABEL: Record<string, string> = {
  pasted_answer: "Most of the answer was pasted",
  pasted_section: "A large part was pasted",
  bulk_paste: "A long block arrived in one paste",
  not_typed: "Almost nothing was typed in the editor",
  little_typing: "Much less was typed than the answer contains",
  impossible_speed: "The answer appeared faster than it could be written",
  frequent_tab_away: "Left the page repeatedly",
  tab_away: "Left the page while solving",
  long_absence: "Several minutes away mid-answer",
  left_exam_mode: "Left exam mode",
  ai_style: "The writing resembles AI-generated text",
};

/**
 * The student's own copy of their integrity record.
 *
 * Exists because the penalty does. Being marked down by an automated process,
 * warned that a third such mark closes your account, and then given no way to
 * see what was recorded or how to contest it is not a fair process — and it is
 * the first thing a placement cell will ask about before signing a licence.
 *
 * Read through the student's own client, so RLS is what decides they may see
 * these rows rather than a filter that could be got wrong.
 */
export default async function IntegrityRecordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/settings/integrity");

  const { data } = await supabase
    .from("submission_integrity")
    .select(
      "submission_id, severity, score, penalty_pct, flags, cleared_at, created_at, cases(slug, title)",
    )
    .neq("severity", "clean")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = data ?? [];
  const strikes = rows.filter(
    (r) => r.severity === "severe" && !r.cleared_at,
  ).length;
  const left = Math.max(0, STRIKES_BEFORE_BLOCK - strikes);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Academic integrity</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        How your answers are checked, and what has been recorded on your account.
      </p>

      <Card className="mt-6">
        <CardContent className="flex items-start gap-3 p-5">
          {strikes === 0 ? (
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--success)]" />
          ) : (
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          )}
          <div className="space-y-1">
            <p className="font-medium">
              {strikes === 0
                ? "Your account is in good standing."
                : `${plural(strikes, "flagged submission")} on your record.`}
            </p>
            <p className="text-sm text-muted-foreground">
              {strikes === 0
                ? "Nothing has been flagged in the last year."
                : left > 0
                  ? `${plural(left, "more flagged submission")} will suspend your account. Flags older than a year stop counting.`
                  : "Your account has been suspended. Contact your placement cell to appeal."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">What is checked</p>
          <p>
            While you write, the editor records how the answer arrived: what was
            typed, what was pasted, and how often the page lost focus. The grader
            separately notes whether the writing reads as AI-generated.
          </p>
          <p>
            An answer is only marked down when there is evidence it was not
            composed in the editor — pasted in, or never typed. Writing that
            merely <em>reads</em> as AI is never enough on its own, because
            careful formal English is not proof of anything.
          </p>
          <p>
            If you think a flag is wrong, ask your teacher or placement cell to
            review it. They can clear it, and clearing it restores your standing
            straight away.
          </p>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-medium">Record</h2>
          {rows.map((row) => {
            const kase = Array.isArray(row.cases) ? row.cases[0] : row.cases;
            return (
              <Card
                key={row.submission_id}
                className={row.cleared_at ? "opacity-60" : undefined}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        row.cleared_at
                          ? "outline"
                          : row.severity === "severe"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {row.cleared_at ? "cleared" : row.severity}
                    </Badge>
                    {kase ? (
                      <Link
                        href={`/cases/${kase.slug}?submission=${row.submission_id}#review`}
                        className="text-sm font-medium underline underline-offset-2"
                      >
                        {kase.title}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">Case removed</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(row.created_at)}
                      {row.cleared_at ? "" : ` · −${row.penalty_pct}%`}
                    </span>
                  </div>
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {row.flags.map((flag) => (
                      <li key={flag}>· {FLAG_LABEL[flag] ?? flag}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
