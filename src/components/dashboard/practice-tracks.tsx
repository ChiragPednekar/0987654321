import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrackProgress } from "@/lib/student-dashboard";
import { DOMAIN_ICON, DifficultyMeter, Meter, eyebrow, panel } from "./primitives";

/** Every published skill track with this student's progress through it. */
export function PracticeTracks({ tracks }: { tracks: TrackProgress[] }) {
  return (
    <section aria-labelledby="tracks-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="tracks-heading" className="dash-display text-lg font-bold tracking-[-0.01em] text-dx-ink">
            Skill tracks
          </h2>
          <p className="mt-0.5 text-sm text-dx-ink-2">
            Ordered cases; each step clears when your best score reaches its bar.
          </p>
        </div>
        <Link
          href="/cases"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300"
        >
          Browse all library <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {tracks.length === 0 ? (
        <p className={cn(panel, "mt-4 p-5 text-sm text-dx-ink-2")}>
          No skill tracks are published yet. The{" "}
          <Link href="/cases" className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">
            case library
          </Link>{" "}
          has everything in the meantime.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:max-[1359px]:grid-cols-3">
          {tracks.map((track) => (
            <li key={track.slug}>
              <TrackCard track={track} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TrackCard({ track }: { track: TrackProgress }) {
  const Icon = DOMAIN_ICON[track.domain];
  const percent = track.total > 0 ? Math.round((track.completed / track.total) * 100) : 0;
  const remaining = Math.max(0, track.total - track.completed);

  return (
    <Link
      href={`/paths/${track.slug}`}
      className={cn(
        panel,
        "group flex h-full flex-col p-5 transition-[border-color,box-shadow] hover:border-blue-300 hover:shadow-md dark:hover:border-blue-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
          <Icon className="size-5" aria-hidden />
        </span>
        <ArrowUpRight
          className="size-4 text-dx-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-blue-600"
          aria-hidden
        />
      </div>
      <h3 className="dash-display mt-3 text-[15px] font-bold text-dx-ink">{track.title}</h3>
      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-dx-ink-2">{track.description}</p>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
        <span className="dash-mono text-dx-ink">
          {track.completed}/{track.total} <span className="text-dx-muted">cases</span>
        </span>
        <span className="dash-mono text-dx-muted">
          {percent}% mastered · {remaining} left
        </span>
      </div>
      <Meter value={percent} label={`${track.title}: ${percent}% mastered`} className="mt-2" />

      <div className="mt-4 border-t border-dx-border pt-3 text-xs">
        {track.next ? (
          <>
            <p className={`${eyebrow} text-dx-muted`}>Next recommended</p>
            <p className="mt-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1 font-medium leading-snug text-dx-ink">
                {track.next.title}
              </span>
              <DifficultyMeter difficulty={track.next.difficulty} className="shrink-0 text-dx-muted" />
            </p>
          </>
        ) : (
          <p className="font-medium text-emerald-700 dark:text-emerald-400">Track complete — every step cleared.</p>
        )}
      </div>
    </Link>
  );
}
