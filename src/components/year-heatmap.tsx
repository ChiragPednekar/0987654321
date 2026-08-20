import { cn } from "@/lib/utils";

export type YearCounts = Record<string, number>;

const DAY_MS = 86_400_000;

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function level(count: number) {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

const LEVEL_CLASS = [
  "bg-muted",
  "bg-primary/30",
  "bg-primary/60",
  "bg-primary",
] as const;

/**
 * A full year of activity, GitHub-style.
 *
 * Max streak is computed here rather than read from `users.longest_streak`,
 * because that column tracks solves for gamification while this grid counts
 * submissions — showing one number over the other's data would be wrong.
 */
export function YearHeatmap({ counts }: { counts: YearCounts }) {
  const today = new Date();
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  const days: { key: string; count: number; date: Date }[] = [];
  for (let i = 52 * 7 - 1; i >= 0; i--) {
    const date = new Date(end.getTime() - i * DAY_MS);
    const key = isoDay(date);
    days.push({ key, count: counts[key] ?? 0, date });
  }

  const total = days.reduce((sum, d) => sum + d.count, 0);
  const activeDays = days.filter((d) => d.count > 0).length;

  let maxStreak = 0;
  let run = 0;
  for (const day of days) {
    run = day.count > 0 ? run + 1 : 0;
    if (run > maxStreak) maxStreak = run;
  }

  const columns: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) columns.push(days.slice(i, i + 7));

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {total} submission{total === 1 ? "" : "s"} in the past year
      </p>

      <div className="mt-3 flex gap-[3px] overflow-x-auto pb-1">
        {columns.map((week, index) => (
          <div key={index} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <div
                key={day.key}
                title={`${day.count} on ${day.date.toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}`}
                className={cn(
                  "size-[10px] rounded-[2px]",
                  LEVEL_CLASS[level(day.count)],
                  day.count === 0 && "ring-1 ring-inset ring-border/50",
                )}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {activeDays} active {activeDays === 1 ? "day" : "days"} · max streak{" "}
          {maxStreak}
        </span>
        <span className="flex items-center gap-1">
          Less
          {LEVEL_CLASS.map((klass, i) => (
            <span
              key={i}
              className={cn(
                "size-[10px] rounded-[2px]",
                klass,
                i === 0 && "ring-1 ring-inset ring-border/50",
              )}
            />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
