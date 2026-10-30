import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One number, as a tile in the style of Apple's Health and Fitness summaries:
 * a white rounded tile, the label in the tone's colour at the top, the figure
 * large in SF Rounded, and a footnote under it.
 *
 * The tone colours the label, not the number, so the meaning sits right above
 * the figure it qualifies and is also said in words — colour never carries it
 * alone. `icon` and `accent` are still accepted so no call site has to change;
 * they are not drawn.
 */
export function StatCard({
  label,
  value,
  sublabel,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: LucideIcon;
  /** Legacy: no longer drawn. */
  accent?: string;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  const labels = {
    default: "text-brand",
    positive: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  } as const;

  return (
    <div className="rounded-xl border border-border-subtle bg-card p-4 shadow-sm dark:shadow-none">
      <p className={cn("text-[13px] font-semibold", labels[tone])}>{label}</p>
      <p className="mt-2 font-rounded text-[2rem] font-bold leading-none tracking-[-0.02em] tabular sm:text-[2.25rem]">
        {value}
      </p>
      {sublabel && (
        <p className="mt-2 text-xs leading-snug text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}
