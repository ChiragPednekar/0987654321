import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, GraduationCap, TrendingDown, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RosterTable } from "@/components/institution/roster-table";
import { DOMAIN_LABEL } from "@/lib/constants";
import { formatNumber, timeAgo } from "@/lib/utils";
import type {
  Domain,
  InstitutionDomainRow,
  InstitutionRosterRow,
  InstitutionRow,
} from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Placement dashboard",
  description: "Cohort performance across your campus licence.",
};

/** A student who has not been graded in this many days counts as lapsed. */
const STALE_DAYS = 14;

export default async function InstitutionPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/institution");

  const admin = createAdminClientOrNull();
  if (!admin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-xl font-semibold">Dashboard unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The server is missing its service-role key.
        </p>
      </div>
    );
  }

  // Which institution does this person staff? Staff/owner only — a student
  // hitting this URL is not shown a cohort they happen to belong to.
  const { data: memberships } = await admin
    .from("institution_members")
    .select("institution_id, role")
    .eq("user_id", profile.id)
    .in("role", ["owner", "staff"]);

  if (!memberships || memberships.length === 0) redirect("/dashboard");

  const { data: institution } = await admin
    .from("institutions")
    .select("*")
    .eq("id", memberships[0].institution_id)
    .single<InstitutionRow>();

  if (!institution) redirect("/dashboard");

  const [{ data: roster }, { data: domains }, { count: seatsUsed }] =
    await Promise.all([
      admin.rpc("institution_roster", { p_institution: institution.id }),
      admin.rpc("institution_domain_breakdown", { p_institution: institution.id }),
      admin
        .from("institution_members")
        .select("user_id", { count: "exact", head: true })
        .eq("institution_id", institution.id)
        .eq("role", "student"),
    ]);

  const students = (roster ?? []) as InstitutionRosterRow[];
  const byDomain = (domains ?? []) as InstitutionDomainRow[];

  const cutoff = Date.now() - STALE_DAYS * 86_400_000;
  const activeRecently = students.filter(
    (s) => s.last_active && new Date(s.last_active).getTime() >= cutoff,
  );
  const neverStarted = students.filter((s) => !s.last_active);

  const graded = students.filter((s) => s.avg_percentage !== null);
  const cohortAvg = graded.length
    ? graded.reduce((a, s) => a + Number(s.avg_percentage), 0) / graded.length
    : null;

  const totalSolved = students.reduce((a, s) => a + s.cases_solved, 0);
  const totalInterviews = students.reduce((a, s) => a + Number(s.interviews), 0);

  const seatFill = institution.seats_licensed
    ? ((seatsUsed ?? 0) / institution.seats_licensed) * 100
    : 0;

  const daysLeft = institution.licence_ends_on
    ? Math.ceil(
        (new Date(institution.licence_ends_on).getTime() - Date.now()) / 86_400_000,
      )
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="size-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">
              {institution.name}
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Placement dashboard · cohort performance across your licence.
          </p>
        </div>
        {daysLeft !== null ? (
          <Badge variant={daysLeft < 45 ? "warning" : "secondary"}>
            Licence {daysLeft > 0 ? `renews in ${daysLeft} days` : "expired"}
          </Badge>
        ) : null}
      </div>

      {/* ------------------------------------------------------- KPIs --- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Seats used</p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatNumber(seatsUsed ?? 0)}
              <span className="text-base font-normal text-muted-foreground">
                {" "}/ {formatNumber(institution.seats_licensed)}
              </span>
            </p>
            <Progress value={seatFill} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              Active last {STALE_DAYS} days
            </p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatNumber(activeRecently.length)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {students.length
                ? `${Math.round((activeRecently.length / students.length) * 100)}% of enrolled`
                : "no students yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cases solved</p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatNumber(totalSolved)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground tabular">
              {formatNumber(totalInterviews)} mock interviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cohort average</p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {cohortAvg !== null ? `${cohortAvg.toFixed(1)}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              across {formatNumber(graded.length)} graded students
            </p>
          </CardContent>
        </Card>
      </div>

      {/* -------------------------------------------------- attention --- */}
      {neverStarted.length > 0 ? (
        <Card className="mt-6 border-amber-500/40">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="text-sm">
              <p className="font-medium">
                {neverStarted.length} enrolled{" "}
                {neverStarted.length === 1 ? "student has" : "students have"} never
                submitted an answer
              </p>
              <p className="mt-0.5 text-muted-foreground">
                They hold a seat but have not started. Worth a nudge before the
                placement season narrows.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ---------------------------------------------------- domains --- */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="size-4 text-muted-foreground" />
            Where the batch is weakest
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byDomain.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No graded submissions yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {byDomain.map((row) => (
                <li key={row.domain} className="flex items-center gap-4">
                  <span className="w-44 shrink-0 text-sm">
                    {DOMAIN_LABEL[row.domain as Domain]}
                  </span>
                  <Progress
                    value={Number(row.avg_percentage ?? 0)}
                    className="flex-1"
                  />
                  <span className="w-16 shrink-0 text-right text-sm tabular">
                    {row.avg_percentage !== null
                      ? `${Number(row.avg_percentage).toFixed(1)}%`
                      : "—"}
                  </span>
                  <span className="w-28 shrink-0 text-right text-xs text-muted-foreground tabular">
                    {formatNumber(Number(row.cases_solved))} solved
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Ordered weakest first. This is the list to build revision sessions
            around.
          </p>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------- roster --- */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-muted-foreground" />
            Students
            <span className="text-sm font-normal text-muted-foreground tabular">
              ({formatNumber(students.length)})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RosterTable students={students} staleDays={STALE_DAYS} />
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">
        Students see only their own results. This page is visible to placement
        staff on your licence.
      </p>
    </div>
  );
}
