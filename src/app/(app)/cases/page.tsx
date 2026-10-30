import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, CircleDashed, Circle } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PickToggle } from "@/components/teacher/library-picker";
import { PickHint } from "@/components/teacher/pick-hint";
import { CaseFilters } from "@/components/case-filters";
import {
  CasesByTrack,
  type TrackGroup,
} from "@/components/cases-by-track";
import {
  CASES_PER_PAGE,
  CASE_FORMAT_LABEL,
  COMPANY_TRACKS,
  DOMAIN_LABEL,
} from "@/lib/constants";
import { cn, plural } from "@/lib/utils";
import { SearchX } from "lucide-react";
import { Page, PageHeader } from "@/components/page-header";
import { SegmentedNav } from "@/components/segmented-nav";
import { DifficultySignal } from "@/components/difficulty-signal";
import { CaseTags } from "@/components/case-tags";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
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
  view?: string;
  q?: string;
  page?: string;
  all?: string;
}>;

export default async function CasesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const profile = await getCurrentUser();
  // Teachers tick cases here and add them to a batch.
  const canAssign = profile?.role === "teacher" || profile?.role === "admin";

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * CASES_PER_PAGE;

  /**
   * Builds the library query.
   *
   * `filterVisibility` is a parameter rather than a constant because the filter
   * depends on a column grant that a database may not have yet. The library is
   * the platform's own catalogue — a teacher's question is scoped to one batch
   * and reaches its students through the assignment, not through here — and the
   * row policy on `cases` enforces that too, so this filter is the second lock.
   *
   * But a second lock that jams shuts the door. When production had the
   * `visibility` column without the matching grant, every read came back 42501
   * and the library rendered 0 of 510 cases: the catalogue, which is the whole
   * product, simply vanished. Falling back to the unfiltered query keeps the
   * library working and leans on the row policy, which is the boundary that
   * actually matters.
   */
  const hasAnyFilter = Boolean(
    params.domain ||
    params.difficulty ||
    params.track ||
    params.format ||
    params.firm ||
    params.status ||
    params.saved ||
    params.q
  );

  // If no filter is selected and no specific page was chosen, show all cases.
  const showAll = params.all === "1" || (!hasAnyFilter && !params.page);

  const buildQuery = () => {
    return supabase
      .from("cases")
      .select(
        "id, slug, title, domain, difficulty, company_track, firm_style, format, is_pro, estimated_minutes, completion_rate, total_submissions, tags",
        { count: "exact" },
      )
      .eq("is_published", true);
  };

  let query = buildQuery();

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

  const ordered = (q: typeof query) => {
    const base = q
      .order("difficulty", { ascending: true })
      .order("created_at", { ascending: true });
    return showAll ? base.range(0, 999) : base.range(from, from + CASES_PER_PAGE - 1);
  };

  const { data: cases, count } = await ordered(query);

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

  const byTrack = params.view === "tracks";
  const solvedCount = [...bestByCase.values()].filter((pct) => pct >= 60).length;

  let trackGroups: TrackGroup[] = [];
  if (byTrack) {
    const { data: paths } = await supabase
      .from("learning_paths")
      .select(
        "id, slug, title, domain, learning_path_steps(step_order, cases(id, slug, title, difficulty))",
      )
      .eq("is_published", true)
      .order("sort_order");

    trackGroups = (paths ?? [])
      .map((path) => {
        const steps = (path.learning_path_steps ?? []) as unknown as {
          step_order: number;
          cases: {
            id: string;
            slug: string;
            title: string;
            difficulty: string;
          } | null;
        }[];

        return {
          id: path.id,
          slug: path.slug,
          title: path.title,
          domain: path.domain,
          cases: steps
            .filter((step) => step.cases)
            .sort((a, b) => a.step_order - b.step_order)
            .map((step) => ({ ...step.cases!, step_order: step.step_order })),
        };
      })
      .filter((group) => group.cases.length > 0);
  }

  const solvedIds = new Set(
    [...bestByCase.entries()]
      .filter(([, pct]) => pct >= 60)
      .map(([id]) => id),
  );

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
    <Page>
      <PageHeader
        eyebrow="Practise"
        title="Cases"
        subtitle="Pick one and commit to a recommendation."
        stats={[
          { value: count ?? 0, label: count === 1 ? "case" : "cases" },
          ...(profile ? [{ value: solvedCount, label: "solved" }, { value: attemptedCaseIds.size, label: "attempted" }] : []),
        ]}
      />
      {canAssign && <PickHint noun="cases" />}

      <SegmentedNav
        label="Library view"
        className="mt-8"
        items={[
          { href: "/cases", label: "Every case", active: !byTrack },
          { href: "/cases?view=tracks", label: "By track", active: byTrack },
        ]}
      />

      <div className="mt-5">
        <CaseFilters
          companyTracks={[...COMPANY_TRACKS]}
          signedIn={Boolean(profile)}
        />
      </div>

      {byTrack ? (
        <CasesByTrack
          tracks={trackGroups}
          solvedIds={solvedIds}
          attemptedIds={attemptedCaseIds}
        />
      ) : (
      <div className="mt-8">
        {/* Column headers — hidden on mobile, where each row stacks. */}
        <div className="hidden items-center gap-4 border-b border-border pb-2 text-[12px] font-medium text-muted-foreground sm:flex">
          <span className={cn("w-5", canAssign && "ml-9")} />
          <span className="flex-1">Case</span>
          <span className="w-36">Domain</span>
          <span className="w-24">Difficulty</span>
          <span className="w-16 text-right">Time</span>
          <span className="w-20 text-right">Solve rate</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={SearchX}
            title="No cases match those filters"
            description="Loosen a filter or two, or start again from the whole library."
            action={
              <Button variant="secondary" asChild>
                <Link href="/cases">Clear filters</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border border-b border-border">
            {filtered.map((item) => {
              const best = bestByCase.get(item.id);
              const solved = best !== undefined && best >= 60;
              const attempted = attemptedCaseIds.has(item.id);

              return (
                <li key={item.id} className={cn(canAssign && "flex items-center gap-3")}>
                  {canAssign && <PickToggle kind="case" id={item.id} title={item.title} />}
                  <Link
                    href={`/cases/${item.slug}`}
                    className="group flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1 py-3.5 sm:flex-nowrap sm:gap-4"
                  >
                    <span className="hidden w-5 shrink-0 sm:block">
                      {solved ? (
                        <CheckCircle2 className="size-3.5 translate-y-0.5 text-success" aria-label="Solved" />
                      ) : attempted ? (
                        <CircleDashed className="size-3.5 translate-y-0.5 text-warning" aria-label="Attempted" />
                      ) : (
                        <Circle className="size-3.5 translate-y-0.5 text-muted-foreground/30" aria-label="Not started" />
                      )}
                    </span>

                    <span className="w-full min-w-0 sm:w-auto sm:flex-1">
                      <span className="font-medium leading-snug group-hover:text-brand">
                        {item.title}
                      </span>
                      {(item.is_pro || item.format !== "full_case" || item.company_track) && (
                        <span className="ml-2 text-[12px] text-muted-foreground">
                          {[
                            item.company_track,
                            item.format !== "full_case" ? CASE_FORMAT_LABEL[item.format as CaseFormat] : null,
                            item.is_pro ? "Pro" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                      <CaseTags tags={item.tags} className="mt-0.5" />
                    </span>

                    <span className="shrink-0 text-xs text-muted-foreground sm:w-36">
                      {DOMAIN_LABEL[item.domain as Domain]}
                    </span>

                    <span className="shrink-0 sm:w-24">
                      <DifficultySignal difficulty={item.difficulty as Difficulty} />
                    </span>

                    <span className="shrink-0 text-xs text-muted-foreground tabular sm:w-16 sm:text-right">
                      {item.estimated_minutes} min
                    </span>

                    <span className="hidden shrink-0 text-xs text-muted-foreground tabular sm:inline sm:w-20 sm:text-right">
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
      </div>
      )}

      {!byTrack && !showAll && totalPages > 1 && (
        <nav
          className="mt-6 flex items-center justify-between"
          aria-label="Pagination"
        >
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="text-sm underline underline-offset-4">← Previous</Link>
          ) : (
            <span className="text-sm text-subtle-foreground">← Previous</span>
          )}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular">
              Page {page} of {totalPages}
            </span>
            <Link
              href="/cases?all=1"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Show all cases
            </Link>
          </div>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="text-sm underline underline-offset-4">Next →</Link>
          ) : (
            <span className="text-sm text-subtle-foreground">Next →</span>
          )}
        </nav>
      )}

      {!byTrack && showAll && (count ?? 0) > 0 && (
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span>Showing all {plural(filtered.length, "case")}</span>
          <Link
            href="/cases?page=1"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Switch to paginated view (20 per page)
          </Link>
        </div>
      )}
    </Page>
  );
}
