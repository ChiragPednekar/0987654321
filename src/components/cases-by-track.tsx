import Link from "next/link";
import { CheckCircle2, Circle, CircleDashed } from "lucide-react";
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
      <p className="mt-8 border-t border-border pt-4 text-sm text-muted-foreground">
        No tracks have cases assigned yet.
      </p>
    );
  }

  // Each track is a section of the contents page: its title in the Didone
  // over an ink rule, then its steps in order — the numbering is real here,
  // because a track unlocks one step at a time.
  return (
    <div>
      {tracks.map((track) => {
        const solved = track.cases.filter((c) => solvedIds.has(c.id)).length;

        return (
          <section key={track.id} className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2">
              <Link
                href={`/paths/${track.slug}`}
                className="font-editorial text-[1.6rem] leading-tight hover:italic"
              >
                {track.title}
              </Link>
              <span className="font-mono text-xs text-muted-foreground tabular">
                {DOMAIN_LABEL[track.domain as Domain]} · {solved}/{track.cases.length} solved
              </span>
            </div>

            <ul className="divide-y divide-border">
              {track.cases.map((item) => {
                const isSolved = solvedIds.has(item.id);
                const isAttempted = !isSolved && attemptedIds.has(item.id);

                return (
                  <li key={item.id}>
                    <Link
                      href={`/cases/${item.slug}`}
                      className="group flex items-baseline gap-4 py-3"
                    >
                      <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground tabular">
                        {String(item.step_order).padStart(2, "0")}
                      </span>
                      <span className="shrink-0">
                        {isSolved ? (
                          <CheckCircle2 className="size-3.5 translate-y-0.5 text-success" aria-label="Solved" />
                        ) : isAttempted ? (
                          <CircleDashed className="size-3.5 translate-y-0.5 text-warning" aria-label="Attempted" />
                        ) : (
                          <Circle className="size-3.5 translate-y-0.5 text-muted-foreground/30" aria-label="Not started" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-editorial text-[1.1rem] group-hover:italic">
                        {item.title}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-xs capitalize",
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
          </section>
        );
      })}
    </div>
  );
}
