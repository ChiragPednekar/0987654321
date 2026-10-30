import { cn } from "@/lib/utils";

export type ChipTone = "brand" | "info" | "success" | "highlight" | "warning" | "danger" | "neutral";

const TONES: Record<ChipTone, { chip: string; label: string }> = {
  brand: { chip: "bg-brand-surface border-brand-border", label: "text-brand" },
  info: { chip: "bg-info-surface border-info-border", label: "text-info" },
  success: { chip: "bg-success-surface border-success-border", label: "text-success" },
  highlight: { chip: "bg-highlight-surface border-highlight-border", label: "text-highlight" },
  warning: { chip: "bg-warning-surface border-warning-border", label: "text-warning" },
  danger: { chip: "bg-danger-surface border-danger-border", label: "text-danger" },
  neutral: { chip: "bg-card border-border-subtle", label: "text-muted-foreground" },
};

/**
 * One of the numbers a student checks every day (streak, cases solved,
 * average score, rank), as a compact tinted chip: the label in words in the
 * tone's colour, the figure in SF Rounded beside it. The tint tells the chips
 * apart at a glance; the label says what each one is, so colour never
 * carries the meaning alone. `StatCard` is the large version for detail pages.
 */
export function StatChip({
  label,
  value,
  unit,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  /** A word after the figure: "days", "/ 10". */
  unit?: string;
  tone?: ChipTone;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-xl border px-3.5 py-2.5", t.chip, className)}>
      <span className={cn("truncate text-[12px] font-semibold", t.label)}>{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="font-rounded text-[1.375rem] font-bold leading-none tracking-[-0.02em] tabular">{value}</span>
        {unit && <span className="text-[13px] text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
}

/** A row of chips that wraps on a phone and sits on one line on a laptop. */
export function StatChipRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5", className)}>{children}</div>;
}
