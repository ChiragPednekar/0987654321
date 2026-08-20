import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      <Card>
        <CardContent className="flex flex-col items-start gap-3 p-5">
          <GraduationCap className="size-5 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Add your school</p>
            <p className="text-sm text-muted-foreground">
              Campus leaderboards rank you against people at your own school,
              not the whole platform.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings">Add it in settings</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { university, rank, cohortSize } = standing;
  const meaningful = rank !== null && cohortSize > 1;
  const topPct = meaningful
    ? Math.max(1, Math.round((rank / cohortSize) * 100))
    : null;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <GraduationCap className="size-4 text-muted-foreground" />
          <p className="truncate text-sm font-medium">{university}</p>
        </div>

        {meaningful ? (
          <>
            <p className="mt-3 text-2xl font-semibold tracking-tight tabular">
              #{formatNumber(rank)}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                of {formatNumber(cohortSize)}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Top {topPct}% at your school
            </p>
            {/* Filled from the top, so a better rank shows a fuller bar. */}
            <Progress value={100 - (topPct ?? 0)} className="mt-3" />
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {cohortSize <= 1
              ? "You're the first here. Solve a case and your classmates will have something to chase."
              : "Solve a case to take a place on your campus board."}
          </p>
        )}

        <Button variant="ghost" size="sm" className="mt-3 px-0" asChild>
          <Link href={`/leaderboard?uni=${encodeURIComponent(university)}`}>
            View campus board →
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
