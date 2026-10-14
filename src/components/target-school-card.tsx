import Link from "next/link";
import { Section } from "@/components/section";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/utils";

export interface CohortStanding {
  university: string;
  /** Rank within the cohort, 1-based. Null when the viewer is unranked. */
  rank: number | null;
  cohortSize: number;
}

/**
 * Where the viewer sits on their own campus board.
 *
 * Percentile is expressed as "top N%", which is what people actually quote
 * about themselves. With a cohort of one it is meaningless, so it is withheld
 * rather than proudly reporting "top 100%".
 */
export function TargetSchoolCard({
  standing,
}: {
  standing: CohortStanding | null;
}) {
  if (!standing) {
    return (
      <Section title="Your campus">
        <p className="pt-3 text-sm text-muted-foreground">
          Campus leaderboards rank you against people at your own school,
          not the whole platform.{" "}
          <Link href="/settings" className="text-foreground underline underline-offset-4">
            Add your school in settings
          </Link>
          .
        </p>
      </Section>
    );
  }

  const { university, rank, cohortSize } = standing;
  const meaningful = rank !== null && cohortSize > 1;
  const topPct = meaningful
    ? Math.max(1, Math.round((rank / cohortSize) * 100))
    : null;

  return (
    <Section
      title="Your campus"
      action={
        <Link
          href={`/leaderboard?uni=${encodeURIComponent(university)}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Campus board
        </Link>
      }
    >
      <div className="pt-4">
        <p className="truncate font-mono text-xs text-muted-foreground">{university}</p>
        {meaningful ? (
          <>
            <p className="mt-2 font-editorial text-[2.6rem] leading-none tracking-[-0.02em] tabular">
              #{formatNumber(rank)}
              <span className="ml-2 font-sans text-sm text-muted-foreground">
                of {formatNumber(cohortSize)} · top {topPct}%
              </span>
            </p>
            {/* Filled from the top, so a better rank shows a fuller bar. */}
            <Progress value={100 - (topPct ?? 0)} className="mt-4 h-1" />
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {cohortSize <= 1
              ? "You're the first here. Solve a case and your classmates will have something to chase."
              : "Solve a case to take a place on your campus board."}
          </p>
        )}
      </div>
    </Section>
  );
}
