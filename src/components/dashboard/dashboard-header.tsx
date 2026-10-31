import { Flame } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { eyebrow } from "./primitives";

export function DashboardHeader({
  greeting,
  firstName,
  today,
  subtitle,
  streak,
  level,
  ce,
}: {
  greeting: string;
  firstName: string | null;
  today: string;
  subtitle: string;
  streak: number;
  level: number;
  ce: number;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className={`${eyebrow} text-dx-muted`}>
          Dashboard <span className="mx-1.5 text-dx-border">/</span>
          <time>{today}</time>
        </p>
        <h1 className="dash-display mt-2 text-[26px] font-bold leading-tight tracking-[-0.02em] text-dx-ink sm:text-[30px]">
          {greeting}
          {firstName ? (
            <>
              , <span className="text-blue-600 dark:text-blue-400">{firstName}</span>
            </>
          ) : null}
          .
        </h1>
        <p className="mt-1.5 text-sm text-dx-ink-2">{subtitle}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300"
          title={streak > 0 ? `${streak} days in a row with a solved case` : "Solve a case today to start a streak"}
        >
          <Flame className="size-3.5" aria-hidden />
          <span>
            <span className="dash-mono">{streak}</span>-day streak
          </span>
        </span>
        <span className="dash-mono inline-flex items-center rounded-full border border-dx-border bg-dx-card px-3 py-1.5 text-xs text-dx-ink-2">
          Level {level} · {formatNumber(ce)} CE
        </span>
      </div>
    </header>
  );
}
