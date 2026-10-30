import { cn } from "@/lib/utils";

/**
 * A section of an app page, in the shape of Apple's inset grouped list: a
 * bold title (Title 3) with an optional action at its trailing edge, then the
 * content. Rows go in a `SectionList`, which is the white rounded group on the
 * grey page with inset separators between rows. Shared by the student and
 * teacher dashboards.
 */
export function Section({
  title,
  count,
  action,
  description,
  className,
  children,
}: {
  title: string;
  /** Shown beside the title, e.g. the number of rows. */
  count?: number;
  /** A link or button at the trailing edge of the header. */
  action?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("mt-10 min-w-0", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1 pb-2">
        <h2 className="text-[1.25rem] font-bold leading-tight tracking-[-0.018em]">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-base font-medium text-muted-foreground tabular">
              {count}
            </span>
          )}
        </h2>
        {action && <div className="text-sm">{action}</div>}
      </div>
      {description && <p className="-mt-1 mb-2 px-1 text-[13px] text-muted-foreground">{description}</p>}
      <div>{children}</div>
    </section>
  );
}

/** Rows under a Section: an inset grouped list. */
export function SectionList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <ul
      className={cn(
        "min-w-0 divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-card px-4 shadow-sm dark:shadow-none",
        className,
      )}
    >
      {children}
    </ul>
  );
}

/** What a Section says when it has nothing in it yet. */
export function SectionEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-border-subtle bg-card px-4 py-5 text-center text-sm text-muted-foreground shadow-sm dark:shadow-none">
      {children}
    </p>
  );
}

/**
 * Something worth the teacher's attention: a rounded callout, tinted when it
 * is a warning.
 */
export function Note({
  tone = "default",
  title,
  children,
  className,
}: {
  tone?: "default" | "warning";
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3 text-sm",
        tone === "warning" ? "bg-warning-surface" : "bg-card shadow-xs dark:shadow-none",
        className,
      )}
    >
      <p className={cn("font-semibold", tone === "warning" && "text-warning")}>{title}</p>
      {children && <p className="mt-0.5 text-muted-foreground">{children}</p>}
    </div>
  );
}
