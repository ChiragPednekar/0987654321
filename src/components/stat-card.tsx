import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * One number, with enough hierarchy that a row of them is scannable.
 *
 * The previous version gave the label, the value and the sublabel three sizes
 * of the same grey, so a row of four cards read as an undifferentiated block
 * and the eye had nowhere to land. Three changes fix that without adding
 * decoration:
 *
 *   - the label becomes a small muted caption, so it does not compete with
 *     the number;
 *   - the number gets tighter tracking and more size, because it is the only
 *     thing anyone is actually looking for;
 *   - the icon stays small and quiet, and `tone` colours it only when it
 *     means something — amber for attention needed, green for healthy.
 */
export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
  /** Legacy escape hatch: a raw class applied to the icon. */
  accent?: string;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  // Tone colours the icon only. A tinted well per card turned a row of stats
  // into a row of coloured badges; the number is what should stand out.
  const wells = {
    default: "text-muted-foreground",
    positive: "text-[var(--success)]",
    warning: "text-[var(--warning)]",
    danger: "text-destructive",
  } as const;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md",
              wells[tone],
            )}
          >
            <Icon className={cn("size-3.5", accent)} />
          </span>
        </div>

        <div className="mt-3 text-[2rem] font-medium leading-none tracking-tight tabular">
          {value}
        </div>

        {sublabel && (
          <p className="mt-2 text-xs leading-snug text-muted-foreground">
            {sublabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
