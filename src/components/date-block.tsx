import { cn } from "@/lib/utils";

const part = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString("en-IN", { ...options, timeZone: "Asia/Kolkata" });

/**
 * An event's date as a small desk calendar (NOV / 14 / FRI) for contest,
 * competition and group-discussion rows. In IST, like every date in the app.
 */
export function DateBlock({ date, className }: { date: string | Date; className?: string }) {
  const d = typeof date === "string" ? new Date(date) : date;
  const month = part(d, { month: "short" }).toUpperCase();
  const day = part(d, { day: "numeric" });
  const weekday = part(d, { weekday: "short" }).toUpperCase();
  return (
    <time
      dateTime={d.toISOString()}
      aria-label={part(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      className={cn(
        "flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-border bg-card text-center",
        className,
      )}
    >
      <span aria-hidden className="w-full bg-brand-surface py-0.5 text-[11px] font-semibold tracking-wide text-brand">
        {month}
      </span>
      <span aria-hidden className="font-rounded text-[1.375rem] font-bold leading-tight tabular">{day}</span>
      <span aria-hidden className="pb-1 text-[11px] font-medium text-muted-foreground">{weekday}</span>
    </time>
  );
}
