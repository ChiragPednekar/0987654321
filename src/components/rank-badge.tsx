import { cn } from "@/lib/utils";

const PODIUM: Record<1 | 2 | 3, string> = {
  1: "border-highlight-border bg-highlight-surface text-highlight",
  2: "border-border bg-secondary text-secondary-foreground",
  3: "border-warning-border bg-warning-surface text-warning",
};

/**
 * A leaderboard position. The top three sit in tinted capsules (gold, silver,
 * bronze); everyone else is a plain figure. Same width either way, so the
 * names after it line up.
 */
export function RankBadge({
  rank,
  podium: allowPodium = true,
  className,
}: {
  rank: number;
  /** False when the rank carries no medal, e.g. everyone is tied on zero points. */
  podium?: boolean;
  className?: string;
}) {
  const podium = allowPodium && rank >= 1 && rank <= 3 ? PODIUM[rank as 1 | 2 | 3] : null;
  return (
    <span
      aria-label={`Rank ${rank}`}
      className={cn(
        "inline-flex h-6 min-w-10 items-center justify-center rounded-full px-2 text-[13px] tabular",
        podium ? cn("border font-semibold", podium) : "font-medium text-muted-foreground",
        className,
      )}
    >
      #{rank}
    </span>
  );
}
