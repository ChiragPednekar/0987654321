import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One number, set like a column in a ledger.
 *
 * No box and no icon: a rule across the top, a small label, and the figure in
 * the display face. A row of four bordered cards with an icon in each corner
 * is the default dashboard of every generated app, and the icons said nothing
 * the label did not. The rule carries the tone instead — ink normally, green
 * when healthy, amber when it needs attention, red when something is wrong —
 * so the meaning sits right above the number it qualifies.
 *
 * `icon` and `accent` are still accepted so no call site has to change; they
 * are no longer drawn.
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
  const rules = {
    default: "border-foreground",
    positive: "border-success",
    warning: "border-warning",
    danger: "border-danger",
  } as const;

  return (
    <div className={cn("border-t-2 pb-1 pt-3", rules[tone])}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2.5 font-editorial text-[2.2rem] font-normal leading-none tracking-[-0.02em] tabular sm:text-[2.6rem]">
        {value}
      </p>
      {sublabel && (
        <p className="mt-2 text-xs leading-snug text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}
