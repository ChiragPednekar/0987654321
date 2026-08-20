import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, CircleDashed, Clock, Circle } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { CaseFilters } from "@/components/case-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CASES_PER_PAGE,
  CASE_FORMAT_LABEL,
  COMPANY_TRACKS,
  DIFFICULTY_CLASS,
  DOMAIN_LABEL,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { CaseFormat, Difficulty, Domain } from "@/lib/types/database";

export const metadata: Metadata = { title: "Cases" };

type SearchParams = Promise<{
  domain?: string;
  difficulty?: string;
  track?: string;
  format?: string;
  firm?: string;
  status?: string;
  saved?: string;
  q?: string;
  page?: string;
}>;

export default async function CasesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentUser();

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * CASES_PER_PAGE;

  let query = supabase
    .from("cases")
    .select(
      "id, slug, title, domain, difficulty, company_track, firm_style, format, is_pro, estimated_minutes, completion_rate, total_submissions",
      { count: "exact" },
    )
    .eq("is_published", true);

  // ?saved=1 restricts the library to bookmarked cases.
  if (params.saved === "1") {
    if (!profile) {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      const { data: saved } = await supabase
        .from("bookmarks")
        .select("case_id")
        .eq("user_id", profile.id);

      const ids = (saved ?? []).map((row) => row.case_id);
      query = query.in(
        "id",
        ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"],
      );
    }
  }

  if (params.domain) query = query.eq("domain", params.domain as Domain);
  if (params.difficulty)
    query = query.eq("difficulty", params.difficulty as Difficulty);
  if (params.track) query = query.eq("company_track", params.track);
  if (params.format) query = query.eq("format", params.format as CaseFormat);
  if (params.firm) query = query.eq("firm_style", params.firm);
  if (params.q) {
    // Escape PostgREST's `or` filter delimiters before interpolating.
    const safe = params.q.replace(/[(),]/g, " ").trim();
    if (safe) query = query.or(`title.ilike.%${safe}%,scenario.ilike.%${safe}%`);
  }

  const { data: cases, count } = await query
    .order("difficulty", { ascending: true })
    .order("created_at", { ascending: true })
    .range(from, from + CASES_PER_PAGE - 1);

  // Solve state for the signed-in user, fetched in one round trip.
  let bestByCase = new Map<string, number>();
  let attemptedCaseIds = new Set<string>();

  if (profile) {
    const [{ data: best }, { data: attempts }] = await Promise.all([
      supabase
        .from("user_case_best")
        .select("case_id, percentage")
        .eq("user_id", profile.id),
      supabase.from("submissions").select("case_id").eq("user_id", profile.id),
    ]);

    bestByCase = new Map(
      (best ?? []).map((row) => [row.case_id, Number(row.percentage)]),
    );
    attemptedCaseIds = new Set((attempts ?? []).map((row) => row.case_id));
  }

  const filtered = (cases ?? []).filter((item) => {
    if (!params.status || !profile) return true;
    const best = bestByCase.get(item.id);
    if (params.status === "solved") return best !== undefined && best >= 60;
    if (params.status === "attempted")
      return attemptedCaseIds.has(item.id) && !(best !== undefined && best >= 60);
    if (params.status === "todo") return !attemptedCaseIds.has(item.id);
    return true;
  });

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / CASES_PER_PAGE));

  function pageHref(target: number) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") next.set(key, String(value));
    }
    next.set("page", String(target));
    return `/cases?${next.toString()}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Case library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {count ?? 0} cases · pick one and commit to a recommendation.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <CaseFilters
          companyTracks={[...COMPANY_TRACKS]}
          signedIn={Boolean(profile)}
        />
      </div>

      <Card className="mt-6 overflow-hidden">
        {/* Column headers — hidden on mobile where rows become cards. */}
        <div className="hidden items-center gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:flex">
          <span className="w-6" />
          <span className="flex-1">Title</span>
          <span className="w-36">Domain</span>
          <span className="w-24">Difficulty</span>
          <span className="w-20 text-right">Time</span>
          <span className="w-24 text-right">Solve rate</span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No cases match those filters.
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/cases">Clear filters</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((item) => {
              const best = bestByCase.get(item.id);
              const solved = best !== undefined && best >= 60;
              const attempted = attemptedCaseIds.has(item.id);

              return (
                <li key={item.id}>
                  <Link
                    href={`/cases/${item.slug}`}
                    className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="w-6 shrink-0">
                      {solved ? (
                        <CheckCircle2
                          className="size-4 text-[var(--success)]"
                          aria-label="Solved"
                        />
                      ) : attempted ? (
                        <CircleDashed
                          className="size-4 text-[var(--warning)]"
                          aria-label="Attempted"
                        />
                      ) : (
                        <Circle
                          className="size-4 text-muted-foreground/40"
                          aria-label="Not started"
                        />
                      )}
                    </span>

                    <span className="flex-1 truncate text-sm font-medium">
                      {item.title}
                      {item.is_pro && (
                        <Badge
                          className="ml-2 align-middle bg-[var(--warning)] text-[10px] text-black"
                          title="Requires a paid plan"
                        >
                          PRO
                        </Badge>
                      )}
                      {item.format !== "full_case" && (
                        <Badge variant="outline" className="ml-2 align-middle">
                          {CASE_FORMAT_LABEL[item.format as CaseFormat]}
                        </Badge>
                      )}
                      {item.company_track && (
                        <Badge variant="secondary" className="ml-2 align-middle">
                          {item.company_track}
                        </Badge>
                      )}
                    </span>

                    <span className="w-36 shrink-0 text-xs text-muted-foreground">
                      {DOMAIN_LABEL[item.domain as Domain]}
                    </span>

                    <span
                      className={cn(
                        "w-24 shrink-0 text-xs font-medium capitalize",
                        DIFFICULTY_CLASS[item.difficulty as Difficulty],
                      )}
                    >
                      {item.difficulty}
                    </span>

                    <span className="flex w-20 shrink-0 items-center gap-1 text-xs text-muted-foreground sm:justify-end">
                      <Clock className="size-3" />
                      {item.estimated_minutes}m
                    </span>

                    <span className="w-24 shrink-0 text-xs text-muted-foreground tabular sm:text-right">
                      {item.total_submissions > 0
                        ? `${(Number(item.completion_rate) * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {totalPages > 1 && (
        <nav
          className="mt-6 flex items-center justify-between"
          aria-label="Pagination"
        >
          <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
            {page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span>Previous</span>}
          </Button>
          <span className="text-sm text-muted-foreground tabular">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            asChild={page < totalPages}
          >
            {page < totalPages ? (
              <Link href={pageHref(page + 1)}>Next</Link>
            ) : (
              <span>Next</span>
            )}
          </Button>
        </nav>
      )}
    </div>
  );
}
