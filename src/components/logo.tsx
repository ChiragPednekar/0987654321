import { cn } from "@/lib/utils";

/**
 * The CaseCode wordmark: the name in the display face, and an examiner's tick
 * in the vermilion pen — the one colour on the site reserved for marking.
 *
 * Replaces a letter "C" in a filled square, which is the default logo of
 * every generated app. The tick is drawn as a pen stroke (round caps, a
 * slightly longer second stroke) rather than a geometric check icon, because
 * the thing it stands for is a person's mark on a page.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1 font-display text-[17px] font-semibold tracking-[-0.02em]", className)}>
      CaseCode
      <svg
        viewBox="0 0 16 14"
        className="size-[0.8em] translate-y-[0.05em] text-mark"
        aria-hidden
      >
        <path
          d="M2 7.6 L6 11.4 L14.2 2.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
