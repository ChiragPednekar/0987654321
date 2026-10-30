import { cn } from "@/lib/utils";

/**
 * The frame every app page sits in. It owns the width, the side gutters and
 * the distance from the top bar, so no page sets its own and every page's
 * content starts at the same x and the same y. One width for every page: a
 * page whose content is a narrow form keeps the frame and narrows the form
 * (`narrow`), left-aligned, so its title doesn't drift right.
 */
export function Page({
  narrow = false,
  className,
  children,
}: {
  /** Keep the content to reading width, still starting at the page's left edge. */
  narrow?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <div className={cn(narrow && "max-w-3xl", className)}>{children}</div>
    </div>
  );
}

export type PageStat = string | { value: React.ReactNode; label: string };

/**
 * The head of every app page, top to bottom: the section it belongs to (the
 * eyebrow), the title, one line on what the page is for, and a line of live
 * counts. One component so the eyebrow is never missing and the title never
 * jumps between pages.
 *
 * `title` is the same string as the page's label in the sidebar.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  stats,
  actions,
  hero = false,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** "214 cases", or { value: 214, label: "cases" } to set the figure in bold. */
  stats?: PageStat[];
  /** At most one prominent button; anything else secondary. */
  actions?: React.ReactNode;
  /** The role dashboards set their header on the tinted welcome panel. */
  hero?: boolean;
  className?: string;
}) {
  const shown = (stats ?? []).filter((s) => (typeof s === "string" ? s.trim() !== "" : true));
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-4",
        hero && "dashboard-hero p-6 sm:p-8",
        className,
      )}
    >
      <div className="min-w-0 max-w-3xl">
        <p className="text-[13px] font-medium text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-1 text-[2rem] font-bold leading-[1.1] tracking-[-0.025em] text-balance sm:text-[2.125rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}
        {shown.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground tabular">
            {shown.map((stat, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                {i > 0 && <span aria-hidden className="text-subtle-foreground">·</span>}
                {typeof stat === "string" ? (
                  stat
                ) : (
                  <span>
                    <span className="font-semibold text-foreground">{stat.value}</span> {stat.label}
                  </span>
                )}
              </span>
            ))}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
