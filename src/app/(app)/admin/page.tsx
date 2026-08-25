import Link from "next/link";
import { redirect } from "next/navigation";
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
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { MODEL_RATES, PLATFORM_INFRA_INR_PER_YEAR } from "@/lib/constants";
import type { InstitutionCommercialsRow } from "@/lib/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { formatNumber, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/admin");
  if (profile.role !== "admin") redirect("/dashboard");

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
  let activeUsers30d = 0;
  const svc = createAdminClientOrNull();
  if (svc) {
    const [{ data: rows }, { data: recent }] = await Promise.all([
      svc.rpc("institution_commercials", {
        p_in_rate_per_million: MODEL_RATES.inputPerMillionUsd,
        p_out_rate_per_million: MODEL_RATES.outputPerMillionUsd,
        p_usd_inr: MODEL_RATES.usdInr,
      }),
      svc
        .from("scores")
        .select("user_id")
        .gte(
          "evaluated_at",
          new Date(Date.now() - 30 * 86_400_000).toISOString(),
        ),
    ]);
    licences = (rows ?? []) as InstitutionCommercialsRow[];
    activeUsers30d = new Set((recent ?? []).map((r) => r.user_id)).size;
  }

  const liveLicences = licences.filter(
    (l) =>
      !l.is_suspended &&
      (!l.licence_ends_on || new Date(l.licence_ends_on) >= new Date()),
  );
  const arr = liveLicences.reduce((a, l) => a + (l.contract_value_inr ?? 0), 0);
  const aiSpend = licences.reduce((a, l) => a + Number(l.ai_cost_inr), 0);
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

      {svc ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Annual contract value"
            value={rupees(arr)}
            sublabel={`${liveLicences.length} live ${liveLicences.length === 1 ? "licence" : "licences"}`}
            icon={IndianRupee}
          />
          <StatCard
            label="AI spend to date"
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
            sublabel="after AI and infra"
            icon={TrendingUp}
          />
          <StatCard
            label="Active students"
            value={formatNumber(activeUsers30d)}
            sublabel="graded something in 30 days"
            icon={Users}
          />
        </div>
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
                      {timeAgo(item.created_at)} · {item.total_submissions}{" "}
                      submissions
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
