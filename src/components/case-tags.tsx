import { caseTagLabels } from "@/lib/tags";
import { cn } from "@/lib/utils";

/**
 * A case's category and tags on one line: the category muted, then the tags
 * in the tint, separated by slashes. "Retail · Profitability / Margin / Cost
 * to serve". Tags are labelled by `tagLabel`, so casing is the same on every
 * row whatever the stored spelling. A span, so it can sit inside a row's link.
 */
export function CaseTags({
  category,
  tags,
  max = 3,
  className,
}: {
  category?: string | null;
  tags: readonly string[] | null | undefined;
  /** Tags beyond this are left off the row, not wrapped. */
  max?: number;
  className?: string;
}) {
  const labels = caseTagLabels(tags).slice(0, max);
  if (!category && labels.length === 0) return null;
  return (
    <span className={cn("flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px]", className)}>
      {category && <span className="text-muted-foreground">{category}</span>}
      {category && labels.length > 0 && (
        <span aria-hidden className="text-subtle-foreground">
          ·
        </span>
      )}
      {labels.length > 0 && <span className="min-w-0 truncate text-brand">{labels.join(" / ")}</span>}
    </span>
  );
}
