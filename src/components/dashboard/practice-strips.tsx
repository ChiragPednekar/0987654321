import Link from "next/link";
import { ArrowRight, Check, Timer, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyDrill } from "@/lib/student-dashboard";
import { eyebrow, panel } from "./primitives";

/** The quick-maths drill of the day. */
export function DailyDrillStrip({ drill }: { drill: DailyDrill }) {
  return (
    <div className={cn(panel, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between")}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">
          <Timer className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className={`${eyebrow} text-orange-700 dark:text-orange-300`}>Daily 5-min drill</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-dx-ink" title={drill.title}>
            {drill.title}
          </p>
        </div>
      </div>
      <Link
        href={`/cases/${drill.slug}`}
        className={cn(
          "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-colors",
          drill.solvedToday
            ? "border border-dx-border text-dx-ink-2 hover:bg-dx-hover"
            : "bg-dx-ink text-dx-card hover:opacity-90",
        )}
      >
        {drill.solvedToday ? (
          <>
            <Check className="size-4 text-emerald-600" aria-hidden /> Done today · again
          </>
        ) : (
          <>
            Solve Quick Drill <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </Link>
    </div>
  );
}

/** The streak badges that exist (badges table: streak-7, streak-30). */
const STREAK_MILESTONES = [
  { days: 7, name: "Week Streak" },
  { days: 30, name: "Month Streak" },
];

/** Where the streak stands and how far the next streak badge is. */
export function StreakBanner({ streak, longest }: { streak: number; longest: number }) {
  const next = STREAK_MILESTONES.find((m) => m.days > streak);
  let message: string;
  if (streak === 0) {
    message = "Solve one case today to start a streak — 7 days in a row earns the Week Streak badge.";
  } else if (next) {
    const left = next.days - streak;
    message = `You're on a ${streak}-day streak. ${left} more ${left === 1 ? "day" : "days"} to the ${next.name} badge.`;
  } else {
    message = `${streak} days in a row — you've earned every streak badge. Keep the run going.`;
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-blue-500/20 dark:bg-blue-500/10">
      <div className="flex min-w-0 items-start gap-3">
        <Trophy className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden />
        <p className="text-sm text-blue-950 dark:text-blue-100">
          {message}
          {longest > streak && (
            <span className="text-blue-800/80 dark:text-blue-200/70"> Your best is {longest} days.</span>
          )}
        </p>
      </div>
      <Link
        href="/profile"
        className="inline-flex shrink-0 items-center gap-1 self-start text-sm font-semibold text-blue-700 hover:text-blue-800 sm:self-auto dark:text-blue-300 dark:hover:text-blue-200"
      >
        View Streak Rewards <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
