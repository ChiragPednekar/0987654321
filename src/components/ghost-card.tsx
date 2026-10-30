import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The last cell of a grid you can add to ("Join a classroom", "Start a study
 * group"): a dashed outline with a plus, the same height as the cards beside
 * it. The only dashed border in the product, so dashed always means "add".
 */
export function GhostCard({
  href,
  onClick,
  label,
  description,
  className,
}: {
  label: string;
  description?: string;
  className?: string;
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never })) {
  const body = (
    <>
      <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-brand-surface text-brand">
        <Plus className="size-5" />
      </span>
      <span className="mt-3 text-[15px] font-semibold text-brand">{label}</span>
      {description && <span className="mt-1 max-w-56 text-[13px] text-muted-foreground">{description}</span>}
    </>
  );
  const classes = cn(
    "flex h-full min-h-40 w-full flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-border p-5 text-center transition-colors hover:border-brand-border hover:bg-brand-surface/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    className,
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={classes}>
      {body}
    </button>
  );
}
