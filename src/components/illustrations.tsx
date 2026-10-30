import { cn } from "@/lib/utils";

/**
 * Line drawings of the tools a case is solved with, for track cards and
 * empty states. One stroke weight, one size, drawn in `currentColor` so the
 * tile around them sets the colour. Decorative: the title beside them says
 * what the track is.
 */
const DRAWINGS = {
  /** A 2×2 prioritisation matrix with one quadrant picked. */
  matrix: (
    <>
      <rect x="8" y="8" width="32" height="32" rx="3" />
      <path d="M24 8v32M8 24h32" />
      <circle cx="32" cy="16" r="3.5" />
    </>
  ),
  /** An issue tree: one question broken into three branches. */
  issueTree: (
    <>
      <rect x="6" y="20" width="10" height="8" rx="2" />
      <path d="M16 24h5M21 12v24M21 12h5M21 24h5M21 36h5" />
      <rect x="26" y="8" width="16" height="8" rx="2" />
      <rect x="26" y="20" width="16" height="8" rx="2" />
      <rect x="26" y="32" width="16" height="8" rx="2" />
    </>
  ),
  /** Bars rising: growth and profitability. */
  barChart: (
    <>
      <path d="M8 40h32" />
      <rect x="11" y="28" width="6" height="12" rx="1.5" />
      <rect x="21" y="20" width="6" height="20" rx="1.5" />
      <rect x="31" y="11" width="6" height="29" rx="1.5" />
    </>
  ),
  /** A marketing and sales funnel. */
  funnel: (
    <>
      <path d="M8 10h32l-11 14v12l-10 4V24L8 10Z" />
      <path d="M13.5 17h21" />
    </>
  ),
  /** A briefcase: consulting and company sets. */
  briefcase: (
    <>
      <rect x="7" y="15" width="34" height="23" rx="3" />
      <path d="M18 15v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4M7 25h34M24 23v4" />
    </>
  ),
  /** A gauge: operations, capacity, utilisation. */
  gauge: (
    <>
      <path d="M8 34a16 16 0 1 1 32 0" />
      <path d="M24 34l8-10" />
      <circle cx="24" cy="34" r="2.5" />
      <path d="M12 34h3M33 34h3M24 18v3" />
    </>
  ),
  /** A price tag: pricing. */
  priceTag: (
    <>
      <path d="M26 8h12a2 2 0 0 1 2 2v12L22 40a2 2 0 0 1-2.8 0L8 28.8a2 2 0 0 1 0-2.8L26 8Z" />
      <circle cx="33" cy="15" r="2.5" />
    </>
  ),
  /** A flag on new ground: market entry. */
  flag: (
    <>
      <path d="M14 40V8" />
      <path d="M14 10h20l-4 6 4 6H14" />
      <path d="M8 40h20" />
    </>
  ),
  /** Two circles joining: mergers and acquisitions. */
  merge: (
    <>
      <circle cx="18" cy="24" r="10" />
      <circle cx="30" cy="24" r="10" />
    </>
  ),
  /** A coin and a line: finance and valuation. */
  valuation: (
    <>
      <circle cx="17" cy="30" r="9" />
      <path d="M17 26v8M14.5 28h5" />
      <path d="M26 20l5-5 4 4 6-7" />
      <path d="M36 12h5v5" />
    </>
  ),
} as const;

export type IllustrationName = keyof typeof DRAWINGS;
export const ILLUSTRATIONS = Object.keys(DRAWINGS) as IllustrationName[];

export function Illustration({ name, className }: { name: IllustrationName; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-8", className)}
    >
      {DRAWINGS[name]}
    </svg>
  );
}

/** The tinted square an illustration sits in. One size everywhere. */
export function IllustrationTile({ name, className }: { name: IllustrationName; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-14 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand",
        className,
      )}
    >
      <Illustration name={name} />
    </span>
  );
}

/** The drawing for each case domain, so a domain looks the same everywhere. */
export const DOMAIN_ILLUSTRATION: Record<string, IllustrationName> = {
  finance: "valuation",
  consulting: "issueTree",
  product_management: "matrix",
  marketing: "funnel",
  strategy: "flag",
  operations: "gauge",
};

export function domainIllustration(domain: string | null | undefined): IllustrationName {
  return (domain && DOMAIN_ILLUSTRATION[domain]) || "briefcase";
}
