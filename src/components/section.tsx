import { cn } from "@/lib/utils";

/**
 * A section of an app page: a title in the editorial serif over an ink rule,
 * then its content on the page itself.
 *
 * The dashboards were stacks of identical white cards, each with a small
 * title in its corner — every section boxed whether or not it needed a box,
 * which is what made them read as a template. This is the structure the
 * landing page uses: the rule says where a section starts, and the paper does
 * the rest. Rows inside are separated by hairlines (`SectionList`). Shared by
 * the student and teacher dashboards.
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
  /** Shown in mono beside the title, e.g. the number of rows. */
  count?: number;
  /** A link or button at the right of the rule. */
  action?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("mt-10", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-foreground pb-2">
        <h2 className="font-editorial text-[1.6rem] font-normal leading-tight tracking-[-0.01em]">
          {title}
          {count !== undefined && (
            <span className="ml-2 font-mono text-sm font-normal text-muted-foreground tabular">
              {count}
            </span>
          )}
        </h2>
        {action}
      </div>
      {description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-1">{children}</div>
    </section>
  );
}

/** Rows under a Section, ruled like a register. */
export function SectionList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <ul className={cn("divide-y divide-border", className)}>{children}</ul>;
}

/** What a Section says when it has nothing in it yet. */
export function SectionEmpty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-muted-foreground">{children}</p>;
}

/**
 * Something worth the teacher's attention, set in the margin of the page
 * rather than boxed: a rule in the tone's colour down the left edge.
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
        "border-l-2 px-4 py-2.5 text-sm",
        tone === "warning" ? "border-warning bg-warning-surface/60" : "border-foreground/40 bg-card/60",
        className,
      )}
    >
      <p className="font-medium">{title}</p>
      {children && <p className="mt-0.5 text-muted-foreground">{children}</p>}
    </div>
  );
}
