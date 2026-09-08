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
 *   - the label becomes a small uppercase eyebrow, so it reads as a caption
 *     rather than competing with the number;
 *   - the number gets tighter tracking and more size, because it is the only
 *     thing anyone is actually looking for;
 *   - the icon sits in a tinted well instead of floating grey, which gives the
 *     card a fixed visual anchor and lets `tone` carry meaning — amber for
 *     something needing attention, green for something healthy.
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
  const wells = {
    default: "bg-muted text-muted-foreground",
    positive: "bg-[var(--success)]/10 text-[var(--success)]",
    warning: "bg-[var(--warning)]/10 text-[var(--warning)]",
    danger: "bg-destructive/10 text-destructive",
  } as const;

  return (
    <Card className="transition-colors hover:border-border/80">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
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

        <div className="mt-3 text-[2rem] font-semibold leading-none tracking-tight tabular">
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
