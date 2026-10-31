import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { DOMAINS } from "@/lib/constants";
import { dailyIndex } from "@/lib/daily-case";
import type { CompanySector } from "@/lib/companies";
import type {
  ActivityType,
  Difficulty,
  Domain,
  EvaluationFeedback,
  RubricCriteria,
} from "@/lib/types/database";
import type { SkillPoint } from "@/components/skill-radar";
import type { HeatmapCounts } from "@/components/submission-heatmap";
import type { WeekPoint } from "@/components/weekly-points";

/**
 * Everything the student dashboard shows, read with the signed-in user's own
 * client so RLS decides what is visible. Each loader degrades to null or an
 * empty list rather than throwing: a missing card is better than a page that
 * fails because one optional query did.
 */

type Db = Awaited<ReturnType<typeof createClient>>;

const DAY = 86_400_000;

/** CE a solve earns by difficulty — the same table the daily case card uses. */
export const CE_BY_DIFFICULTY: Record<Difficulty, number> = { easy: 30, medium: 50, hard: 80 };

function first<T>(value: T | T[] | null | undefined): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/** The opening of a long text, cut on a word. */
export function excerpt(text: string | null | undefined, max: number): string {
  const clean = (text ?? "").replace(/[#*_>`]/g, "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, clean.lastIndexOf(" ", max)).replace(/[,;:.]$/, "")}…`;
}

// ---- up next ---------------------------------------------------------------

export type FeaturedCase = {
  id: string;
  slug: string;
  title: string;
  domain: Domain;
  difficulty: Difficulty;
  format: string;
  minutes: number;
  ceReward: number;
  description: string;
  briefing: string;
  objective: string;
  criteria: { key: string; max: number }[];
  maxScore: number | null;
  saved: boolean;
  /** Why this case: the preparation plan's reason, or that it is today's case. */
  reason: string;
};

/**
 * The case the preparation plan recommends (weakest area first), else the
 * deterministic case of the day. `planHref` is the plan's case link.
 */
export async function loadFeaturedCase(
  db: Db,
  userId: string,
  plan: { href: string; reason: string } | null,
): Promise<FeaturedCase | null> {
  const columns =
    "id, slug, title, domain, difficulty, format, estimated_minutes, scenario, instructions, rubrics(criteria, max_score)";
  const planSlug = plan?.href.match(/^\/cases\/([^/?#]+)/)?.[1] ?? null;

  let row = null;
  let reason = plan?.reason ?? "";
  if (planSlug) {
    const { data } = await db
      .from("cases")
      .select(columns)
      .eq("slug", planSlug)
      .eq("is_published", true)
      .maybeSingle();
    row = data;
  }

  if (!row) {
    const { count } = await db
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true)
      .eq("format", "full_case");
    if (!count) return null;
    const { data } = await db
      .from("cases")
      .select(columns)
      .eq("is_published", true)
      .eq("format", "full_case")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(dailyIndex(count), dailyIndex(count))
      .maybeSingle();
    row = data;
    reason = "Today's case — the same one for everyone, so you can compare notes.";
  }
  if (!row) return null;

  const { data: bookmark } = await db
    .from("bookmarks")
    .select("case_id")
    .eq("user_id", userId)
    .eq("case_id", row.id)
    .maybeSingle();

  const rubric = first(row.rubrics as unknown as { criteria: RubricCriteria; max_score: number } | null);
  const criteria = Object.entries(rubric?.criteria ?? {})
    .map(([key, max]) => ({ key, max: Number(max) }))
    .sort((a, b) => b.max - a.max);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    domain: row.domain as Domain,
    difficulty: row.difficulty as Difficulty,
    format: row.format,
    minutes: row.estimated_minutes,
    ceReward: CE_BY_DIFFICULTY[row.difficulty as Difficulty] ?? 50,
    description: excerpt(row.scenario, 220),
    briefing: excerpt(row.scenario, 700),
    objective: excerpt(row.instructions, 600),
    criteria,
    maxScore: rubric?.max_score ?? null,
    saved: Boolean(bookmark),
    reason,
  };
}

// ---- daily drill -------------------------------------------------------------

export type DailyDrill = { slug: string; title: string; minutes: number; solvedToday: boolean };

/** One quick-maths drill a day, chosen the way the daily case is. */
export async function loadDailyDrill(db: Db, userId: string): Promise<DailyDrill | null> {
  const { count } = await db
    .from("cases")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true)
    .eq("format", "drill");
  if (!count) return null;

  const offset = dailyIndex(count);
  const { data: drill } = await db
    .from("cases")
    .select("id, slug, title, estimated_minutes")
    .eq("is_published", true)
    .eq("format", "drill")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset)
    .maybeSingle();
  if (!drill) return null;

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: attempts } = await db
    .from("drill_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("case_id", drill.id)
    .gte("created_at", startOfDay.toISOString());

  return {
    slug: drill.slug,
    title: drill.title,
    minutes: drill.estimated_minutes,
    solvedToday: (attempts ?? 0) > 0,
  };
}

// ---- skill tracks ------------------------------------------------------------

export type TrackProgress = {
  slug: string;
  title: string;
  domain: Domain;
  description: string;
  icon: string | null;
  completed: number;
  total: number;
  next: { slug: string; title: string; difficulty: Difficulty } | null;
};

/**
 * Learning paths with this user's progress. A step counts as cleared when the
 * best score on its case reaches the step's threshold — the rule the path page
 * itself uses, so the two never disagree.
 */
export async function loadTracks(db: Db, userId: string): Promise<TrackProgress[]> {
  const [{ data: paths }, { data: best }] = await Promise.all([
    db
      .from("learning_paths")
      .select(
        "slug, title, domain, description, icon, sort_order, learning_path_steps(step_order, unlock_threshold, cases(id, slug, title, difficulty))",
      )
      .eq("is_published", true)
      .order("sort_order"),
    db.from("user_case_best").select("case_id, percentage").eq("user_id", userId),
  ]);

  const bestByCase = new Map((best ?? []).map((row) => [row.case_id as string, Number(row.percentage)]));

  return (paths ?? []).map((path) => {
    const steps = [...((path.learning_path_steps ?? []) as unknown as {
      step_order: number;
      unlock_threshold: number;
      cases: { id: string; slug: string; title: string; difficulty: Difficulty } | null;
    }[])].sort((a, b) => a.step_order - b.step_order);

    const cleared = steps.map((step) => {
      const caseRef = first(step.cases);
      const score = caseRef ? bestByCase.get(caseRef.id) : undefined;
      return { caseRef, cleared: score !== undefined && score >= step.unlock_threshold };
    });
    const nextStep = cleared.find((s) => !s.cleared)?.caseRef ?? null;

    return {
      slug: path.slug,
      title: path.title,
      domain: path.domain as Domain,
      description:
        path.description ?? DOMAINS.find((d) => d.value === path.domain)?.description ?? "",
      icon: path.icon,
      completed: cleared.filter((s) => s.cleared).length,
      total: steps.length,
      next: nextStep
        ? { slug: nextStep.slug, title: nextStep.title, difficulty: nextStep.difficulty }
        : null,
    };
  });
}

// ---- target firms ------------------------------------------------------------

export type FirmMatch = {
  company: { slug: string; name: string; sector: CompanySector };
  case: { slug: string; title: string; description: string; difficulty: Difficulty } | null;
  practice: { label: string; href: string; why: string } | null;
};

/** The case style each sector's interviews resemble (cases.firm_style). */
const STYLE_BY_SECTOR: Partial<Record<CompanySector, string>> = {
  Consulting: "MBB-style",
  Technology: "Big Tech PM-style",
  "Banking & finance": "Investment Banking-style",
};

/** Common short forms people type for the firms in the library. */
const ALIASES: Record<string, string[]> = {
  bcg: ["bcg", "boston consulting"],
  "procter-and-gamble": ["p&g", "pg", "procter"],
  hul: ["hul", "unilever", "hindustan unilever"],
  "jp-morgan": ["jpm", "jp morgan", "jpmorgan", "j p morgan"],
  "tata-administrative-services": ["tas", "tata"],
  "goldman-sachs": ["gs", "goldman"],
  "accenture-strategy": ["accenture"],
  "deloitte-consulting": ["deloitte"],
};

function normalise(text: string): string {
  return text.toLowerCase().replace(/&/g, " & ").replace(/[^a-z0-9&]+/g, " ").trim();
}

/**
 * The firms named in the interview profile, matched to company profiles, each
 * with an unsolved case in that sector's interview style. Returns null when no
 * targets are set, so the panel can ask for them.
 */
export async function loadTargetFirms(db: Db, userId: string): Promise<FirmMatch[] | null> {
  const { data: pi } = await db
    .from("pi_profiles")
    .select("target_firms")
    .eq("user_id", userId)
    .maybeSingle();
  const wanted = (pi?.target_firms ?? "")
    .split(/[,;\n/]|\band\b/i)
    .map(normalise)
    .filter((t: string) => t.length >= 2);
  if (wanted.length === 0) return null;

  const { data: companies } = await db
    .from("companies")
    .select("slug, name, sector, practice")
    .eq("is_published", true);

  const matched = (companies ?? []).filter((company) => {
    const name = normalise(company.name);
    const names = [name, ...(ALIASES[company.slug] ?? [])];
    return wanted.some((want: string) =>
      names.some((n) => n === want || n.split(" ")[0] === want || (want.length >= 4 && n.includes(want))),
    );
  });
  if (matched.length === 0) return [];

  const { data: done } = await db
    .from("submissions")
    .select("case_id")
    .eq("user_id", userId)
    .eq("status", "evaluated");
  const doneIds = new Set((done ?? []).map((row) => row.case_id as string));

  const styles = [...new Set(matched.map((c) => STYLE_BY_SECTOR[c.sector as CompanySector]).filter(Boolean))] as string[];
  const { data: styled } = styles.length
    ? await db
        .from("cases")
        .select("id, slug, title, difficulty, firm_style, scenario")
        .eq("is_published", true)
        .in("firm_style", styles)
        .order("total_submissions", { ascending: false })
        .limit(60)
    : { data: [] };

  // Different firms of one style should not all recommend the same case.
  const used = new Set<string>();
  return matched.slice(0, 4).map((company) => {
    const style = STYLE_BY_SECTOR[company.sector as CompanySector];
    const pick = style
      ? (styled ?? []).find((c) => c.firm_style === style && !doneIds.has(c.id) && !used.has(c.id))
      : undefined;
    if (pick) used.add(pick.id);
    const practice = ((company.practice ?? []) as { label: string; href: string; why: string }[])[0] ?? null;
    return {
      company: { slug: company.slug, name: company.name, sector: company.sector as CompanySector },
      case: pick
        ? {
            slug: pick.slug,
            title: pick.title,
            description: excerpt(pick.scenario, 110),
            difficulty: pick.difficulty as Difficulty,
          }
        : null,
      practice,
    };
  });
}

// ---- latest evaluation -------------------------------------------------------

export type LatestEvaluation = {
  caseTitle: string;
  href: string;
  evaluatedAt: string;
  percentage: number;
  criteria: { key: string; score: number; max: number }[];
  note: string | null;
};

export async function loadLatestEvaluation(db: Db, userId: string): Promise<LatestEvaluation | null> {
  const { data: score } = await db
    .from("scores")
    .select("submission_id, breakdown, percentage, feedback, evaluated_at, cases(title, slug, rubrics(criteria))")
    .eq("user_id", userId)
    .order("evaluated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!score) return null;

  const caseRef = first(score.cases as unknown as { title: string; slug: string; rubrics: unknown } | null);
  if (!caseRef) return null;
  const maxes = first(caseRef.rubrics as { criteria: RubricCriteria } | null)?.criteria ?? {};
  const breakdown = (score.breakdown ?? {}) as Record<string, number>;
  const criteria = Object.entries(breakdown)
    .filter(([key]) => maxes[key])
    .map(([key, value]) => ({ key, score: Number(value), max: Number(maxes[key]) }))
    .sort((a, b) => b.max - a.max)
    .slice(0, 2);

  const feedback = (score.feedback ?? {}) as Partial<EvaluationFeedback>;
  const note = feedback.improvements?.[0] ?? feedback.weaknesses?.[0] ?? feedback.strengths?.[0] ?? null;

  return {
    caseTitle: caseRef.title,
    href: `/cases/${caseRef.slug}?submission=${score.submission_id}`,
    evaluatedAt: score.evaluated_at,
    percentage: Number(score.percentage),
    criteria,
    note,
  };
}

// ---- placement benchmark -----------------------------------------------------

export type Benchmark = {
  university: string | null;
  /** Position in the user's college on all-time points; null without one. */
  cohort: { rank: number; size: number; topPercent: number } | null;
  averageScore: number | null;
  graded: number;
  badges: { name: string; tier: string }[];
  badgeCount: number;
};

/** Below this many classmates a percentile says nothing, so none is shown. */
const MIN_COHORT_FOR_PERCENTILE = 5;

export async function loadBenchmark(
  db: Db,
  profile: { id: string; university: string | null },
  domainRows: { avg_percentage: number | string | null; cases_solved: number | string | null }[],
): Promise<Benchmark> {
  const university = profile.university?.trim() || null;

  const [{ data: earned, count: badgeCount }, cohort] = await Promise.all([
    db
      .from("achievements")
      .select("badges(name, tier)", { count: "exact" })
      .eq("user_id", profile.id)
      .order("earned_at", { ascending: false })
      .limit(4),
    university ? cohortStanding(db, profile.id, university) : Promise.resolve(null),
  ]);

  const graded = domainRows.reduce((sum, row) => sum + Number(row.cases_solved ?? 0), 0);
  const averageScore =
    graded > 0
      ? domainRows.reduce((sum, row) => sum + Number(row.avg_percentage ?? 0) * Number(row.cases_solved ?? 0), 0) / graded
      : null;

  return {
    university,
    cohort,
    averageScore,
    graded,
    badges: (earned ?? [])
      .map((row) => first(row.badges as unknown as { name: string; tier: string } | null))
      .filter((b): b is { name: string; tier: string } => Boolean(b)),
    badgeCount: badgeCount ?? 0,
  };
}

/**
 * Rank among classmates on all-time points. Positional within the college, so
 * it is counted: the stored `rank` on leaderboards is global.
 */
async function cohortStanding(db: Db, userId: string, university: string) {
  const [{ count: size }, { data: mine }] = await Promise.all([
    db
      .from("leaderboards")
      .select("user_id, users!inner(university)", { count: "exact", head: true })
      .eq("period", "all_time")
      .eq("users.university", university),
    db
      .from("leaderboards")
      .select("total_points")
      .eq("period", "all_time")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (!mine || !size || size < MIN_COHORT_FOR_PERCENTILE) return null;

  const { count: ahead } = await db
    .from("leaderboards")
    .select("user_id, users!inner(university)", { count: "exact", head: true })
    .eq("period", "all_time")
    .eq("users.university", university)
    .gt("total_points", mine.total_points ?? 0);

  const rank = (ahead ?? 0) + 1;
  return { rank, size, topPercent: Math.max(1, Math.ceil((rank / size) * 100)) };
}

// ---- practice record ---------------------------------------------------------

export type ActivityItem = {
  id: string;
  type: ActivityType;
  ceDelta: number;
  createdAt: string;
  caseRef: { title: string; slug: string } | null;
  label: string;
};

export type PracticeRecord = {
  heatmap: HeatmapCounts;
  weekly: WeekPoint[];
  radar: SkillPoint[];
  activity: ActivityItem[];
};

/** The last eight weeks of practice, moved here from the old dashboard page. */
export async function loadPracticeRecord(
  db: Db,
  userId: string,
  domainRows: { domain: string; avg_percentage: number | string | null; cases_solved: number | string | null }[],
  now: number,
): Promise<PracticeRecord> {
  const since = new Date(now - 8 * 7 * DAY).toISOString();
  const [{ data: submissions }, { data: scores }, { data: activity }] = await Promise.all([
    db.from("submissions").select("created_at").eq("user_id", userId).gte("created_at", since).limit(1000),
    db.from("scores").select("total_score, evaluated_at").eq("user_id", userId).gte("evaluated_at", since).limit(500),
    db
      .from("user_activity")
      .select("id, type, ce_delta, created_at, metadata, cases(title, slug)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const heatmap: HeatmapCounts = {};
  for (const row of submissions ?? []) {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    heatmap[key] = (heatmap[key] ?? 0) + 1;
  }

  const weekKey = (t: number) => `${new Date(t).getUTCFullYear()}-${Math.floor(t / (7 * DAY))}`;
  const buckets = new Map<string, { points: number; solved: number }>();
  for (let i = 7; i >= 0; i--) buckets.set(weekKey(now - i * 7 * DAY), { points: 0, solved: 0 });
  for (const row of scores ?? []) {
    const bucket = buckets.get(weekKey(new Date(row.evaluated_at).getTime()));
    if (bucket) {
      bucket.points += row.total_score ?? 0;
      bucket.solved += 1;
    }
  }
  const weekly: WeekPoint[] = [...buckets.values()].map((value, index) => ({
    label: index === 7 ? "This wk" : `-${7 - index}w`,
    points: value.points,
    solved: value.solved,
  }));

  // Every domain appears, even at zero, so the shape compares between users.
  const byDomain = new Map(domainRows.map((row) => [row.domain, row]));
  const radar: SkillPoint[] = DOMAINS.map((domain) => {
    const row = byDomain.get(domain.value);
    return {
      domain: domain.short,
      score: Number(row?.avg_percentage ?? 0),
      solved: Number(row?.cases_solved ?? 0),
    };
  });

  return {
    heatmap,
    weekly,
    radar,
    activity: (activity ?? []).map((item) => {
      const metadata = (item.metadata ?? {}) as Record<string, unknown>;
      return {
        id: item.id,
        type: item.type as ActivityType,
        ceDelta: item.ce_delta ?? 0,
        createdAt: item.created_at,
        caseRef: first(item.cases as unknown as { title: string; slug: string } | null),
        label: String(metadata.badge_name ?? (metadata.level ? `Level ${metadata.level}` : "")),
      };
    }),
  };
}
