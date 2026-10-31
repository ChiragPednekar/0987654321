import Link from "next/link";
import { ArrowRight, Award, Building2, FileSearch, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Benchmark, FirmMatch, LatestEvaluation } from "@/lib/student-dashboard";
import { DifficultyMeter, Meter, criterionLabel, eyebrow, panel } from "./primitives";

function PanelHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="dash-display text-[15px] font-bold text-dx-ink">{title}</h2>
      {action}
    </div>
  );
}

// ---- target firms ------------------------------------------------------------

/**
 * Firms from the interview profile (set on /interview), each with an unsolved
 * case in the interview style that firm's sector uses. `firms` is null when no
 * targets are set at all.
 */
export function TargetFirms({ firms }: { firms: FirmMatch[] | null }) {
  const edit = (
    <Link
      href="/interview"
      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300"
    >
      <Pencil className="size-3" aria-hidden /> Edit targets
    </Link>
  );

  return (
    <section className={cn(panel, "p-5")}>
      <PanelHeading title="Matched to target firms" action={edit} />
      {firms === null ? (
        <p className="mt-3 text-sm text-dx-ink-2">
          Name the firms you are aiming for in your interview profile and cases in their interview style
          appear here.
        </p>
      ) : firms.length === 0 ? (
        <p className="mt-3 text-sm text-dx-ink-2">
          None of your target firms has a profile yet.{" "}
          <Link href="/companies" className="font-medium text-blue-700 hover:underline dark:text-blue-300">
            Browse the firms we cover
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {firms.map((firm) => {
            const href = firm.case ? `/cases/${firm.case.slug}` : firm.practice?.href ?? `/companies/${firm.company.slug}`;
            const title = firm.case?.title ?? firm.practice?.label ?? `How ${firm.company.name} interviews`;
            const description = firm.case?.description ?? firm.practice?.why ?? "Rounds, what they look for and how to prepare.";
            return (
              <li key={firm.company.slug}>
                <Link
                  href={href}
                  className="group block rounded-lg border border-dx-border p-3 transition-colors hover:border-blue-300 hover:bg-dx-hover dark:hover:border-blue-500/40"
                >
                  <p className={`${eyebrow} flex items-center gap-1.5 text-dx-muted`}>
                    <Building2 className="size-3" aria-hidden /> {firm.company.name}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-snug text-dx-ink group-hover:text-blue-700 dark:group-hover:text-blue-300">
                    {title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-dx-ink-2">{description}</p>
                  {firm.case && (
                    <DifficultyMeter difficulty={firm.case.difficulty} className="mt-2 text-[11px] text-dx-muted" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---- examiner evaluation -----------------------------------------------------

export function ExaminerEvaluation({ evaluation }: { evaluation: LatestEvaluation | null }) {
  return (
    <section className={cn(panel, "overflow-hidden")}>
      <div className="h-1 bg-gradient-to-r from-orange-500 to-orange-600" aria-hidden />
      <div className="p-5">
        <PanelHeading
          title="Examiner evaluation"
          action={
            evaluation ? (
              <time className="dash-mono text-[11px] text-dx-muted" dateTime={evaluation.evaluatedAt}>
                {new Date(evaluation.evaluatedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  timeZone: "Asia/Kolkata",
                })}
              </time>
            ) : null
          }
        />
        {evaluation ? (
          <>
            <p className="mt-2 text-sm font-semibold leading-snug text-dx-ink">{evaluation.caseTitle}</p>
            <p className="dash-mono mt-0.5 text-[11px] text-orange-700 dark:text-orange-300">
              Overall {Math.round(evaluation.percentage)}%
            </p>
            <dl className="mt-4 space-y-3">
              {evaluation.criteria.map((criterion) => (
                <div key={criterion.key}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <dt className="text-dx-ink-2">{criterionLabel(criterion.key)}</dt>
                    <dd className="dash-mono font-semibold text-dx-ink">
                      {criterion.score}/{criterion.max}
                    </dd>
                  </div>
                  <Meter
                    tone="orange"
                    value={(criterion.score / criterion.max) * 100}
                    label={`${criterionLabel(criterion.key)}: ${criterion.score} of ${criterion.max}`}
                    className="mt-1.5"
                  />
                </div>
              ))}
            </dl>
            {evaluation.note && (
              <blockquote className="mt-4 border-l-2 border-orange-400 pl-3 text-[13px] leading-relaxed text-dx-ink-2">
                {evaluation.note}
              </blockquote>
            )}
            <Link
              href={evaluation.href}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 hover:text-orange-800 dark:text-orange-300"
            >
              <FileSearch className="size-4" aria-hidden /> Review annotated case transcript
            </Link>
          </>
        ) : (
          <p className="mt-3 text-sm text-dx-ink-2">
            No graded answer yet. Submit a case and the examiner&apos;s marks against the rubric land here.
          </p>
        )}
      </div>
    </section>
  );
}

// ---- placement benchmark -----------------------------------------------------

const TIER_CLASS: Record<string, string> = {
  gold: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  silver: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300",
  bronze: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300",
};

export function PlacementBenchmark({ benchmark }: { benchmark: Benchmark }) {
  const { cohort, university, averageScore, graded } = benchmark;

  return (
    <section className={cn(panel, "p-5")}>
      <PanelHeading
        title="Placement benchmark"
        action={
          <Link href="/progress" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300">
            Details <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      />

      <div className="mt-3 rounded-lg bg-dx-subtle/70 p-3">
        {cohort ? (
          <>
            <p className="dash-display text-2xl font-extrabold tracking-[-0.02em] text-dx-ink">
              Top {cohort.topPercent}%
            </p>
            <p className="dash-mono mt-0.5 text-[11px] text-dx-muted">
              #{cohort.rank} of {cohort.size} at {university} · all-time points
            </p>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-dx-ink-2">
            {university
              ? `Your standing at ${university} appears once at least 5 classmates are on the leaderboard.`
              : "Add your college in Settings to see where you stand among classmates."}
          </p>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-dx-ink-2">Interview readiness</span>
          <span className="dash-mono font-semibold text-dx-ink">
            {averageScore !== null ? `${Math.round(averageScore)}%` : "—"}
          </span>
        </div>
        <Meter value={averageScore ?? 0} label="Interview readiness" className="mt-1.5" />
        <p className="mt-1.5 text-[11px] text-dx-muted">
          {graded > 0
            ? `Average rubric score across ${graded} graded ${graded === 1 ? "case" : "cases"}.`
            : "Appears after your first graded case."}
        </p>
      </div>

      <div className="mt-4 border-t border-dx-border pt-3">
        <p className={`${eyebrow} flex items-center justify-between text-dx-muted`}>
          <span className="flex items-center gap-1.5">
            <Award className="size-3" aria-hidden /> Badges earned
          </span>
          <span className="text-dx-ink">{benchmark.badgeCount}</span>
        </p>
        {benchmark.badges.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {benchmark.badges.map((badge, index) => (
              <li
                key={`${badge.name}-${index}`}
                className={cn("rounded-md border px-2 py-0.5 text-[11px] font-medium", TIER_CLASS[badge.tier] ?? TIER_CLASS.silver)}
              >
                {badge.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-dx-ink-2">Your first solved case earns your first badge.</p>
        )}
      </div>
    </section>
  );
}
