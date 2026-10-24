import { AlertTriangle, TrendingDown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Progress } from "@/components/ui/progress";
import { DOMAIN_LABEL } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import { allRows, type CollegeData } from "@/lib/placement/server";
import { batchProgress, STALE_DAYS } from "@/lib/placement/core";
import type { Domain, InstitutionDomainRow, InstitutionRosterRow, InstitutionRow } from "@/lib/types/database";

/**
 * The whole-college picture the old /institution page gave — seats, who is
 * practising, where the batch is weakest — plus movement by batch. Practice
 * here is aggregate or activity only: what a student scored while learning
 * stays out of anything a company sees.
 */
export async function loadOverview(institutionId: string, data: CollegeData) {
  const db = createAdminClient();
  const ids = data.users.map((u) => u.id);
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const [{ data: institution }, { data: roster }, { data: domains }, scores] = await Promise.all([
    db.from("institutions").select("*").eq("id", institutionId).single<InstitutionRow>(),
    db.rpc("institution_roster", { p_institution: institutionId }),
    db.rpc("institution_domain_breakdown", { p_institution: institutionId }),
    (async () => {
      const rows: { user_id: string; percentage: number; evaluated_at: string }[] = [];
      for (let i = 0; i < ids.length; i += 150) {
        rows.push(...(await allRows((a, b) =>
          db.from("scores").select("user_id, percentage, evaluated_at").in("user_id", ids.slice(i, i + 150))
            .gte("evaluated_at", since).order("id").range(a, b))));
      }
      return rows;
    })(),
  ]);
  const batches = data.batches.map((b) => ({
    user_id: b.user_id,
    classroom_id: b.classroom_id,
    name: (Array.isArray(b.classrooms) ? b.classrooms[0] : b.classrooms)?.name ?? "Batch",
  }));
  return {
    institution,
    roster: (roster ?? []) as InstitutionRosterRow[],
    domains: (domains ?? []) as InstitutionDomainRow[],
    batches: batchProgress(batches, scores, Date.now()),
  };
}
export type Overview = Awaited<ReturnType<typeof loadOverview>>;

export function CollegeOverview({ overview, data, now }: { overview: Overview; data: CollegeData; now: number }) {
  const { institution, roster, domains, batches } = overview;
  const cutoff = now - STALE_DAYS * 86_400_000;
  const active = roster.filter((s) => s.last_active && new Date(s.last_active).getTime() >= cutoff).length;
  const neverStarted = roster.filter((s) => !s.last_active).length;
  const graded = roster.filter((s) => s.avg_percentage !== null);
  const cohortAvg = graded.length ? graded.reduce((a, s) => a + Number(s.avg_percentage), 0) / graded.length : null;
  const solved = roster.reduce((a, s) => a + s.cases_solved, 0);
  const interviews = roster.reduce((a, s) => a + Number(s.interviews), 0);
  const assessed = new Set(data.attempts.filter((a) => a.status === "evaluated").map((a) => a.user_id)).size;
  const daysLeft = institution?.licence_ends_on
    ? Math.ceil((new Date(institution.licence_ends_on).getTime() - now) / 86_400_000)
    : null;

  const stats: [string, string, string][] = [
    ["Enrolled", formatNumber(data.users.length),
      institution?.seats_licensed ? `of ${formatNumber(institution.seats_licensed)} seats${daysLeft !== null ? ` · licence ${daysLeft > 0 ? `${daysLeft} days left` : "expired"}` : ""}` : "students"],
    [`Practising (${STALE_DAYS} days)`, formatNumber(active),
      data.users.length ? `${Math.round((active / data.users.length) * 100)}% of the college` : "no students yet"],
    ["Practice done", formatNumber(solved), `${formatNumber(interviews)} mock interviews · average ${cohortAvg === null ? "—" : `${cohortAvg.toFixed(1)}%`}`],
    ["Common assessments", `${assessed} / ${data.users.length}`, "students with an evaluated result"],
  ];

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value, note]) => (
          <div key={label} className="rounded-xl border p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
          </div>
        ))}
      </div>

      {neverStarted > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p>
            <span className="font-medium">
              {neverStarted} enrolled {neverStarted === 1 ? "student has" : "students have"} never submitted an answer.
            </span>{" "}
            <span className="text-muted-foreground">
              They count in every figure on this page, so a small active group never looks like the whole college. Filter the directory by “Not started” to follow up.
            </span>
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border p-5">
          <h2 className="flex items-center gap-2 font-medium">
            <TrendingDown className="size-4 text-muted-foreground" /> Skill gaps, weakest first
          </h2>
          {domains.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No graded practice yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {domains.map((row) => (
                <li key={row.domain} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 truncate">{DOMAIN_LABEL[row.domain as Domain] ?? row.domain}</span>
                  <Progress value={Number(row.avg_percentage ?? 0)} className="flex-1" />
                  <span className="w-14 shrink-0 text-right tabular">
                    {row.avg_percentage !== null ? `${Number(row.avg_percentage).toFixed(0)}%` : "—"}
                  </span>
                  <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground tabular sm:block">
                    {row.students} students
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted-foreground">From practice across the college. Build revision sessions around the top of this list.</p>
        </div>

        <div className="rounded-xl border p-5">
          <h2 className="font-medium">Improvement by batch</h2>
          {batches.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Students are not in any teacher batch yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-2 font-medium">Batch</th><th className="py-2 text-right font-medium">Active</th><th className="py-2 text-right font-medium">Prior 30 days</th><th className="py-2 text-right font-medium">Last 30 days</th></tr>
                </thead>
                <tbody>
                  {batches.map((b) => {
                    const change = b.recentAvg !== null && b.earlierAvg !== null ? b.recentAvg - b.earlierAvg : null;
                    return (
                      <tr key={b.id} className="border-t">
                        <td className="py-2">{b.name}</td>
                        <td className="py-2 text-right tabular">{b.active} / {b.students}</td>
                        <td className="py-2 text-right tabular">{b.earlierAvg === null ? <span className="text-xs text-muted-foreground">too few</span> : `${b.earlierAvg.toFixed(0)}%`}</td>
                        <td className="py-2 text-right tabular">
                          {b.recentAvg === null ? <span className="text-xs text-muted-foreground">too few</span> : `${b.recentAvg.toFixed(0)}%`}
                          {change !== null && (
                            <span className={`ml-2 text-xs ${change >= 0 ? "text-[var(--success)]" : "text-destructive"}`}>
                              {change >= 0 ? "+" : ""}{change.toFixed(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Average practice score, needing at least five graded answers in a window. Students pick different cases, so read this as direction, not proof — the common assessments are the like-for-like comparison.
          </p>
        </div>
      </div>
    </section>
  );
}
