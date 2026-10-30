import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Page-level views as links ("Every case" / "By track"), drawn as the same
 * segmented control as `Tabs`. Use this when each view has its own URL;
 * `Tabs` when the views switch in place.
 */
export function SegmentedNav({
  items,
  label,
  className,
}: {
  items: { href: string; label: string; active: boolean }[];
  /** What the views are, for screen readers: "Library view". */
  label: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "inline-flex h-9 items-center gap-0.5 rounded-[10px] bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] p-0.5",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "touch-target inline-flex h-full items-center whitespace-nowrap rounded-lg px-3.5 text-[13px] font-medium transition-[background-color,box-shadow] duration-200",
            item.active
              ? "bg-card font-semibold shadow-sm dark:bg-[#636366]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
