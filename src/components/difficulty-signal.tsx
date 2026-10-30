import { DIFFICULTIES } from "@/lib/constants";
import type { Difficulty } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const LEVEL: Record<Difficulty, { bars: number; fill: string; chip: string }> = {
  easy: { bars: 1, fill: "bg-success", chip: "text-success" },
  medium: { bars: 2, fill: "bg-warning", chip: "text-warning" },
  hard: { bars: 3, fill: "bg-danger", chip: "text-danger" },
};

/**
 * A case's difficulty as a three-bar signal with the word beside it: one bar
 * for easy, two for medium, three for hard. The word is always there; the
 * bars and the hue only make a list quick to scan.
 */
export function DifficultySignal({
  difficulty,
  showLabel = true,
  className,
}: {
  difficulty: Difficulty;
  showLabel?: boolean;
  className?: string;
}) {
  const level = LEVEL[difficulty];
  const label = DIFFICULTIES.find((d) => d.value === difficulty)?.label ?? difficulty;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", level.chip, className)}
      {...(showLabel ? {} : { role: "img", "aria-label": `Difficulty: ${label}` })}
    >
      <span aria-hidden className="flex h-3 items-end gap-[2px]">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn(
              "w-[3px] rounded-full",
              bar === 1 ? "h-1.5" : bar === 2 ? "h-2.5" : "h-3",
              bar <= level.bars ? level.fill : "bg-[color-mix(in_srgb,var(--foreground)_16%,transparent)]",
            )}
          />
        ))}
      </span>
      {showLabel && label}
    </span>
  );
}
