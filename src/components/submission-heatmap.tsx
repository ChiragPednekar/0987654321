import { cn } from "@/lib/utils";

/** ISO date (YYYY-MM-DD) → number of submissions that day. */
export type HeatmapCounts = Record<string, number>;

const WEEKS = 8;
const DAY_MS = 86_400_000;

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Four buckets is enough to read at a glance; more just adds noise. */
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
 * Last 8 weeks of submissions. Server-rendered — it is static once painted,
 * so there is nothing to gain from shipping it as a client component.
 */
export function SubmissionHeatmap({ counts }: { counts: HeatmapCounts }) {
  const today = new Date();

  // End on the Saturday of this week so columns are whole weeks, then walk
  // back 8 of them.
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  const days: { key: string; count: number; date: Date }[] = [];
  for (let i = WEEKS * 7 - 1; i >= 0; i--) {
    const date = new Date(end.getTime() - i * DAY_MS);
    const key = isoDay(date);
    days.push({ key, count: counts[key] ?? 0, date });
  }

  const activeDays = days.filter((d) => d.count > 0).length;
  const total = days.reduce((sum, d) => sum + d.count, 0);

  // Column-major: each column is a week, each row a weekday.
  const columns: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) columns.push(days.slice(i, i + 7));

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {columns.map((week, index) => (
          <div key={index} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.key}
                title={`${day.count} submission${day.count === 1 ? "" : "s"} on ${day.date.toLocaleDateString(
                  undefined,
                  { day: "numeric", month: "short" },
                )}`}
                className={cn(
                  "size-3 rounded-[3px]",
                  LEVEL_CLASS[level(day.count)],
                  day.count === 0 && "ring-1 ring-inset ring-border/50",
                )}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total} submission{total === 1 ? "" : "s"} · {activeDays} active{" "}
          {activeDays === 1 ? "day" : "days"}
        </span>
        <span className="flex items-center gap-1">
          Less
          {LEVEL_CLASS.map((klass, i) => (
            <span
              key={i}
              className={cn(
                "size-3 rounded-[3px]",
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
