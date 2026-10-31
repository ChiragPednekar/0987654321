import {
  Briefcase,
  Compass,
  Factory,
  LineChart,
  Megaphone,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Difficulty, Domain } from "@/lib/types/database";

/** The dashboard's card surface: white on slate, a fine border, a hairline shadow. */
export const panel =
  "rounded-xl border border-dx-border bg-dx-card shadow-[0_1px_2px_rgb(15_23_42/0.04)]";

/** Small mono capitals used for eyebrows and metadata. */
export const eyebrow = "dash-mono text-[10.5px] font-medium uppercase tracking-[0.12em]";

export const DOMAIN_ICON: Record<Domain, LucideIcon> = {
  finance: LineChart,
  consulting: Briefcase,
  product_management: Boxes,
  marketing: Megaphone,
  strategy: Compass,
  operations: Factory,
};

const LEVEL: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

/** Three bars, filled to the difficulty — readable without colour alone. */
export function DifficultyMeter({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  const level = LEVEL[difficulty];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn(
              "w-[3px] rounded-sm",
              bar === 1 ? "h-1.5" : bar === 2 ? "h-2" : "h-2.5",
              bar <= level ? "bg-current" : "bg-dx-border",
            )}
          />
        ))}
      </span>
      <span className="capitalize">{difficulty}</span>
    </span>
  );
}

/** A slim progress bar; `tone` picks blue (practice) or orange (examiner). */
export function Meter({
  value,
  tone = "blue",
  label,
  className,
}: {
  value: number;
  tone?: "blue" | "orange";
  label: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-dx-subtle", className)}
    >
      <div
        className={cn("h-full rounded-full", tone === "blue" ? "bg-blue-600" : "bg-orange-500")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** "structure_and_mece" → "Structure and MECE". */
export function criterionLabel(key: string): string {
  const text = key.replaceAll("_", " ").replace(/\bmece\b/gi, "MECE");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
