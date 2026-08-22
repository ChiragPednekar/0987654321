import { cn } from "@/lib/utils";

/**
 * Inline trend sparkline (spec §13).
 *
 * Deliberately a plain server-rendered SVG rather than a Recharts chart: these
 * appear several to a page next to stat tiles, and pulling the charting bundle
 * in for a 60x18 line would cost more than everything else on the profile put
 * together. Recharts stays for the full-size charts that need axes and
 * tooltips.
 */
export function Sparkline({
  values,
  className,
  width = 72,
  height = 20,
  label,
}: {
  values: number[];
  className?: string;
  width?: number;
  height?: number;
  /** Screen-reader description; the drawing itself carries no meaning. */
  label?: string;
}) {
  // One point cannot show a trend, and zero points cannot draw a line.
  if (values.length < 2) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        not enough data
      </span>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; draw it down the middle instead.
  const span = max - min || 1;
  const stepX = width / (values.length - 1);

  const points = values.map((value, index) => {
    const x = index * stepX;
    // SVG y grows downward, so invert.
    const y = height - ((value - min) / span) * height;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  const first = values[0];
  const last = values[values.length - 1];
  const rising = last >= first;
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={
        label ??
        `Trend from ${Math.round(first)} to ${Math.round(last)} over ${values.length} points`
      }
    >
      <path
        d={path}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={rising ? "stroke-emerald-500" : "stroke-rose-500"}
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={2}
        className={rising ? "fill-emerald-500" : "fill-rose-500"}
      />
    </svg>
  );
}
