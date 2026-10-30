import { DOMAIN_LABEL } from "@/lib/constants";
import { EmptyState } from "@/components/empty-state";
import { TrackCard } from "@/components/track-card";
import { domainIllustration } from "@/components/illustrations";
import type { Domain } from "@/lib/types/database";

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
 * "Next" follows the track's own order rather than difficulty: the sequence
 * is the pedagogy. A case you started and didn't finish comes first.
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
      <EmptyState
        className="mt-8"
        illustration="issueTree"
        title="No tracks yet"
        description="Tracks appear here once cases are assigned to them."
      />
    );
  }

  // One card per track: how far you are and the next case in its order.
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tracks.map((track) => {
        const solved = track.cases.filter((c) => solvedIds.has(c.id)).length;
        const next =
          track.cases.find((c) => !solvedIds.has(c.id) && attemptedIds.has(c.id)) ??
          track.cases.find((c) => !solvedIds.has(c.id));
        return (
          <TrackCard
            key={track.id}
            href={`/paths/${track.slug}`}
            title={track.title}
            description={DOMAIN_LABEL[track.domain as Domain]}
            illustration={domainIllustration(track.domain)}
            solved={solved}
            total={track.cases.length}
            next={next ? { title: next.title, href: `/cases/${next.slug}` } : undefined}
          />
        );
      })}
    </div>
  );
}
