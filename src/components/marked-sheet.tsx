import { cn } from "@/lib/utils";

/**
 * A student's answer, marked — the one image the site is built around.
 *
 * Drawn like an answer booklet: ruled lines, a margin rule, the answer set in
 * the document serif, and the examiner's vermilion pen on top of it — a
 * wavy underline under the claim that was not shown, a note in the margin,
 * ticks against the rubric and the total circled. It replaces a mock app
 * window with three traffic-light dots, which said "software" and nothing
 * about what this software does.
 *
 * The figures match the example used across the site (a ₹20 Cr burn growing
 * 30%), and the feedback is the kind the grader actually writes.
 */

const RUBRIC: { label: string; got: number; max: number; note?: string }[] = [
  { label: "Financial analysis", got: 18, max: 20 },
  { label: "Market analysis", got: 15, max: 20 },
  { label: "Risk assessment", got: 14, max: 20, note: "no downside case" },
  { label: "Recommendation", got: 17, max: 20 },
];

export function MarkedSheet({ className, compact = false }: { className?: string; compact?: boolean }) {
  const total = RUBRIC.reduce((n, r) => n + r.got, 0);
  const max = RUBRIC.reduce((n, r) => n + r.max, 0);

  return (
    <figure
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-[0_1px_0_var(--shadow-color),0_18px_40px_-24px_var(--shadow-color)]",
        className,
      )}
    >
      <figcaption className="sr-only">
        An example answer to a finance case, marked {total} out of {max}, with the
        examiner&apos;s note that the claim of efficient growth was not shown.
      </figcaption>

      {/* Ruled lines and the margin rule of an answer booklet. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, var(--border-subtle) 27px, var(--border-subtle) 28px)",
          backgroundPosition: "0 14px",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-10 w-px bg-mark/35 sm:left-12" />

      <div className="relative py-5 pl-14 pr-5 sm:pl-16 sm:pr-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Finance · Medium · 25 min
            </p>
            <p className="mt-1 font-display text-[15px] font-semibold leading-snug">
              Lumen Learning: raise now, or extend the runway?
            </p>
          </div>
          <CircledScore total={total} max={max} />
        </div>

        {!compact && (
          <p className="mt-4 font-serif text-[15px] leading-[28px] text-muted-foreground">
            Lumen burns ₹20 Cr a year and grows 30%. Raise ₹40 Cr now at a flat
            valuation, or cut to 18 months of runway and raise later?
          </p>
        )}

        <div className={cn("relative font-serif text-[15px] leading-[28px]", compact ? "mt-3" : "mt-2")}>
          <p className="pr-0 sm:pr-36">
            Raise now. At 30% growth the business is{" "}
            <span className="underline decoration-mark decoration-wavy decoration-[1.5px] underline-offset-[5px]">
              efficient enough to justify the dilution
            </span>
            , and waiting risks a worse market. Put ₹25 Cr into sales hiring and
            hold the rest as runway.
          </p>
          <p className="mt-1 font-serif text-[14px] italic leading-snug text-mark sm:absolute sm:right-0 sm:top-0 sm:mt-0 sm:w-32 sm:-rotate-2">
            Efficient against what? Show the burn multiple.
          </p>
        </div>

        <dl className="mt-4 space-y-1.5 border-t border-dashed border-border pt-3 text-[13px]">
          {RUBRIC.map((r) => (
            <div key={r.label} className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">{r.label}</dt>
              <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-border" />
              {r.note && (
                <span className="hidden font-serif text-[13px] italic text-mark sm:inline">{r.note}</span>
              )}
              <dd className="font-mono tabular">
                {r.got}
                <span className="text-muted-foreground">/{r.max}</span>
              </dd>
              <Tick faint={r.got / r.max < 0.75} />
            </div>
          ))}
        </dl>
      </div>
    </figure>
  );
}

/** The total, circled by hand. */
function CircledScore({ total, max }: { total: number; max: number }) {
  return (
    <div className="relative shrink-0 px-3 py-1.5 text-mark">
      <svg viewBox="0 0 100 56" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <path
          d="M52 4 C80 3 97 13 96 28 C95 45 72 53 48 52 C22 51 4 42 5 27 C6 13 26 5 55 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="relative font-display text-2xl font-semibold tabular leading-none">
        {total}
        <span className="text-sm font-medium">/{max}</span>
      </span>
    </div>
  );
}

/** A tick in the pen; half-strength where the criterion lost real marks. */
function Tick({ faint }: { faint: boolean }) {
  return (
    <svg viewBox="0 0 16 14" className={cn("size-3.5 text-mark", faint && "opacity-35")} aria-hidden>
      <path d="M2 7.6 L6 11.4 L14.2 2.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
