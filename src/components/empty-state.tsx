import type { LucideIcon } from "lucide-react";
import { Illustration, type IllustrationName } from "@/components/illustrations";
import { cn } from "@/lib/utils";

/**
 * What a list says when it has nothing in it: one drawing or icon at one
 * size, a short bold line, one muted line on why or what next, and at most
 * one action. The same size on every page, so an empty Contests page and an
 * empty Assignments page look like the same product.
 */
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  illustration?: IllustrationName;
  title: string;
  description?: React.ReactNode;
  /** One button or link. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-border-subtle bg-card px-6 py-10 text-center shadow-sm dark:shadow-none",
        className,
      )}
    >
      {(Icon || illustration) && (
        <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          {illustration ? <Illustration name={illustration} /> : Icon ? <Icon className="size-7" strokeWidth={1.75} /> : null}
        </span>
      )}
      <p className="mt-4 text-[1.0625rem] font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
