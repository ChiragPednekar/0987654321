import Link from "next/link";
import type { Metadata } from "next";
import {
  BookOpen,
  Building2,
  Cpu,
  FileText,
  IndianRupee,
  TrendingUp,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { MODEL_RATES, PLATFORM_INFRA_INR_PER_YEAR } from "@/lib/constants";
import type {
  InstitutionCommercialsRow,
  PlatformOverviewRow,
} from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { formatNumber, plural, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  // The layout has already established that this is the platform owner.
  const supabase = await createClient();

  const [
    { count: caseCount },
    { count: userCount },
    { count: submissionCount },
    { data: recentCases },
    { data: hardest },
  ] = await Promise.all([
    supabase.from("cases").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("submissions").select("id", { count: "exact", head: true }),
    supabase
      .from("cases")
      .select("id, slug, title, domain, difficulty, is_published, total_submissions, avg_score, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("cases")
      .select("id, slug, title, avg_score, total_submissions")
      .gt("total_submissions", 0)
      .order("avg_score", { ascending: true })
      .limit(5),
  ]);

  // Business view. Optional enrichment — without a service-role key the page
  // still renders as the content-only admin it was before.
  let licences: InstitutionCommercialsRow[] = [];
  let overview: PlatformOverviewRow | null = null;
  const svc = createAdminClientOrNull();
  if (svc) {
    const [{ data: rows }, { data: ov }] = await Promise.all([
      svc.rpc("institution_commercials", {
        p_in_rate_per_million: MODEL_RATES.inputPerMillionUsd,
        p_out_rate_per_million: MODEL_RATES.outputPerMillionUsd,
        p_usd_inr: MODEL_RATES.usdInr,
      }),
      // Aggregated in the database rather than counted in JavaScript, so the
      // page keeps working once the tables are large.
      svc.rpc("platform_overview", { p_days: 30 }),
    ]);
    licences = (rows ?? []) as InstitutionCommercialsRow[];
    overview = ((ov ?? []) as PlatformOverviewRow[])[0] ?? null;
  }

  const liveLicences = licences.filter(
    (l) =>
      !l.is_suspended &&
      (!l.licence_ends_on || new Date(l.licence_ends_on) >= new Date()),
  );
  const arr = liveLicences.reduce((a, l) => a + (l.contract_value_inr ?? 0), 0);
  // Measured from usage_events; the per-licence figures below are the same
  // numbers grouped by contract.
  const aiSpend = Number(overview?.ai_cost_inr ?? 0);
  const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Licences, revenue, usage and content.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/licences">
              <Building2 className="size-4" />
              Licences
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/cases/new">New case</Link>
          </Button>
        </div>
      </div>

      {/*
        People first.
        
        The commercial numbers used to lead, and the user counts sat in a card
        labelled "Roles" whose headline value was the student count with
        everything else crammed into a sublabel. Contract value matters, but it
        is not the first thing anyone opens this page to see — "how many people
        are on the platform and how many of them are actually using it" is.
      */}
      {overview ? (
        <>
          <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            People
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total users"
              value={formatNumber(Number(overview.total_users))}
              sublabel={`${formatNumber(Number(overview.students))} student${
                Number(overview.students) === 1 ? "" : "s"
              } · ${formatNumber(Number(overview.teachers))} teacher${
                Number(overview.teachers) === 1 ? "" : "s"
              } · ${formatNumber(Number(overview.admins))} admin${
                Number(overview.admins) === 1 ? "" : "s"
              }`}
              icon={Users}
            />
            <StatCard
              label="Active (30 days)"
              tone={Number(overview.active_users) > 0 ? "positive" : "default"}
              value={formatNumber(Number(overview.active_users))}
              sublabel={
                Number(overview.total_users) > 0
                  ? `${Math.round((Number(overview.active_users) / Number(overview.total_users)) * 100)}% of accounts`
                  : "no accounts yet"
              }
              icon={TrendingUp}
            />
            <StatCard
              label="New (30 days)"
              value={formatNumber(Number(overview.new_users))}
              sublabel="accounts created"
              icon={Users}
            />
            <StatCard
              label="Never started"
              tone={Number(overview.never_started) > 0 ? "warning" : "default"}
              value={formatNumber(Number(overview.never_started))}
              sublabel="signed up, never attempted a case"
              // The number worth acting on: these are the seats a college is
              // paying for that nobody is using.
              accent={Number(overview.never_started) > 0 ? "text-amber-500" : undefined}
              icon={Users}
            />
          </div>

          <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Activity
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="AI calls"
              value={formatNumber(Number(overview.gradings) + Number(overview.interviews))}
              sublabel={`${formatNumber(Number(overview.gradings))} graded · ${formatNumber(Number(overview.interviews))} interviews`}
              icon={Cpu}
            />
            <StatCard
              label="Tokens used"
              value={formatNumber(Number(overview.total_tokens))}
              sublabel="across every model call"
              icon={Cpu}
            />
            <StatCard
              label="Seats"
              value={`${formatNumber(Number(overview.seats_used))} / ${formatNumber(Number(overview.seats_licensed))}`}
              sublabel={
                Number(overview.seats_licensed) > 0
                  ? `${Math.round((Number(overview.seats_used) / Number(overview.seats_licensed)) * 100)}% utilisation`
                  : "no licences yet"
              }
              icon={Building2}
            />
            <StatCard
              label="Institutions"
              value={formatNumber(Number(overview.active_licences))}
              sublabel={`${overview.expired_licences} expired · ${overview.suspended_licences} suspended`}
              icon={Building2}
            />
          </div>
        </>
      ) : null}

      {svc ? (
        <>
          <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Commercial
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Annual contract value"
              tone={arr > 0 ? "positive" : "default"}
              value={rupees(arr)}
              sublabel={`${liveLicences.length} live ${liveLicences.length === 1 ? "licence" : "licences"}`}
              icon={IndianRupee}
            />
            <StatCard
              label="AI spend to date"
              tone="warning"
              value={rupees(aiSpend)}
              sublabel={`+ ${rupees(PLATFORM_INFRA_INR_PER_YEAR)}/yr infra`}
              icon={Cpu}
            />
            <StatCard
              label="Gross margin"
              value={
                arr > 0
                  ? `${Math.round(((arr - aiSpend - PLATFORM_INFRA_INR_PER_YEAR) / arr) * 100)}%`
                  : "—"
              }
              sublabel={arr > 0 ? "after AI and infra" : "no contracts yet"}
              icon={TrendingUp}
            />
            <StatCard
              label="Cost per active user"
              value={
                Number(overview?.active_users ?? 0) > 0
                  ? rupees(aiSpend / Number(overview!.active_users))
                  : "—"
              }
              sublabel="AI spend ÷ active accounts"
              icon={IndianRupee}
            />
          </div>
        </>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Cases"
          value={formatNumber(caseCount ?? 0)}
          icon={BookOpen}
        />
        <StatCard
          label="Students"
          value={formatNumber(userCount ?? 0)}
          icon={Users}
        />
        <StatCard
          label="Submissions"
          value={formatNumber(submissionCount ?? 0)}
          icon={FileText}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent cases</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/cases">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {(recentCases ?? []).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/cases/${item.slug}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(item.created_at)} ·{" "}
                      {plural(item.total_submissions, "submission")}
                    </p>
                  </div>
                  <Badge variant={item.is_published ? "success" : "secondary"}>
                    {item.is_published ? "Live" : "Draft"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4" />
              Hardest cases
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Lowest average score. Check whether the rubric is unfair before
              assuming students are weak.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {(hardest ?? []).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <Link
                    href={`/cases/${item.slug}`}
                    className="min-w-0 truncate text-sm hover:underline"
                  >
                    {item.title}
                  </Link>
                  <span className="shrink-0 text-sm tabular">
                    {Number(item.avg_score).toFixed(0)}%
                  </span>
                </li>
              ))}
              {(!hardest || hardest.length === 0) && (
                <li className="py-4 text-sm text-muted-foreground">
                  No graded submissions yet.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
