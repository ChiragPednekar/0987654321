import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IllustrationTile, type IllustrationName } from "@/components/illustrations";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * A track: a themed set of cases (Profitability, Market entry, a company's
 * set). The card says how far you are and what to do next: a drawing, the
 * title, "4/25 solved", a progress bar with what's left and the percentage,
 * then the next case.
 *
 * The card fills the height of its grid cell and the next-case row sits at
 * the bottom, so a row of cards lines up whatever each one has to say.
 */
export function TrackCard({
  href,
  title,
  description,
  illustration,
  solved,
  total,
  next,
  forYourGoal = false,
  action,
  className,
}: {
  href: string;
  title: string;
  description?: string;
  illustration: IllustrationName;
  solved: number;
  total: number;
  /** The case to do next. Omit when the track is finished. */
  next?: { title: string; href: string };
  /** The track matches the student's target role or school. */
  forYourGoal?: boolean;
  /** A control in the top corner, above the card's link (a teacher's pick toggle). */
  action?: React.ReactNode;
  className?: string;
}) {
  const done = Math.min(solved, total);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const left = Math.max(total - done, 0);

  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-xl border border-border-subtle bg-card p-5 shadow-sm transition-[border-color,box-shadow] hover:border-border hover:shadow-md dark:shadow-none",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <IllustrationTile name={illustration} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em]">
            {/* The title is the card's link; the overlay makes the whole card a target. */}
            <Link href={href} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring">
              {title}
            </Link>
          </h3>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground tabular">
              {done}/{total} solved
            </span>
            {forYourGoal && (
              <span className="inline-flex items-center rounded-full bg-brand-surface px-2.5 py-0.5 text-xs font-medium text-brand">
                For your goal
              </span>
            )}
          </p>
        </div>
        {action && <div className="relative z-10 shrink-0">{action}</div>}
      </div>

      {description && <p className="mt-3 text-sm text-muted-foreground">{description}</p>}

      <div className="mt-4">
        <Progress value={percent} aria-label={`${title}: ${percent}% solved`} />
        <p className="mt-1.5 flex justify-between text-[12px] text-muted-foreground tabular">
          <span>{total === 0 ? "No cases yet" : left === 0 ? "All solved" : `${left} left`}</span>
          <span>{percent}%</span>
        </p>
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-2 border-t border-border-subtle pt-3 text-sm">
          {next ? (
            <Link
              href={next.href}
              className="relative z-10 flex min-w-0 items-center gap-1.5 rounded-sm hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="shrink-0 font-semibold text-brand">Next</span>
              <ArrowRight aria-hidden className="size-3.5 shrink-0 text-brand" />
              <span className="truncate">{next.title}</span>
            </Link>
          ) : total === 0 ? (
            <span className="text-muted-foreground">Cases coming soon</span>
          ) : (
            <span className="text-success">Track complete</span>
          )}
        </div>
      </div>
    </article>
  );
}
