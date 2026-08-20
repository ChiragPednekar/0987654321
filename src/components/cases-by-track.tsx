import Link from "next/link";
import { CheckCircle2, Circle, CircleDashed } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_CLASS, DOMAIN_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Difficulty, Domain } from "@/lib/types/database";

export interface TrackCase {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  step_order: number;
}

export interface TrackGroup {
  id: string;
  slug: string;
  title: string;
  domain: string;
  cases: TrackCase[];
}

/**
 * The library grouped by learning track rather than as a flat list.
 *
 * Cases keep their track order rather than being re-sorted by difficulty: the
 * sequence is the pedagogy, and reordering it would defeat the point of a
 * track.
 */
export function CasesByTrack({
  tracks,
  solvedIds,
  attemptedIds,
}: {
  tracks: TrackGroup[];
  solvedIds: Set<string>;
  attemptedIds: Set<string>;
}) {
  if (tracks.length === 0) {
    return (
      <Card className="mt-6">
        <p className="px-4 py-16 text-center text-sm text-muted-foreground">
          No tracks have cases assigned yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {tracks.map((track) => {
        const solved = track.cases.filter((c) => solvedIds.has(c.id)).length;

        return (
          <Card key={track.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
              <div className="min-w-0">
                <Link
                  href={`/paths/${track.slug}`}
                  className="truncate text-sm font-semibold hover:underline"
                >
                  {track.title}
                </Link>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {DOMAIN_LABEL[track.domain as Domain]}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular">
                    {solved}/{track.cases.length} solved
                  </span>
                </div>
              </div>
            </div>

            <ul className="divide-y divide-border">
              {track.cases.map((item) => {
                const isSolved = solvedIds.has(item.id);
                const isAttempted = !isSolved && attemptedIds.has(item.id);

                return (
                  <li key={item.id}>
                    <Link
                      href={`/cases/${item.slug}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40"
                    >
                      <span className="w-6 shrink-0 text-xs text-muted-foreground tabular">
                        {item.step_order}
                      </span>
                      <span className="shrink-0">
                        {isSolved ? (
                          <CheckCircle2
                            className="size-4 text-[var(--success)]"
                            aria-label="Solved"
                          />
                        ) : isAttempted ? (
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
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {item.title}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-medium capitalize",
                          DIFFICULTY_CLASS[item.difficulty as Difficulty],
                        )}
                      >
                        {item.difficulty}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
