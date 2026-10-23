/**
 * A quiet "1,240 / 1,500" under a message box, shown only once the message is
 * past four-fifths of its limit — the point at which it starts to matter.
 */
export function CharCount({ value, max }: { value: string; max: number }) {
  if (value.length < max * 0.8) return null;
  const full = value.length >= max;
  return (
    <p className={`text-right text-[11px] tabular-nums ${full ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">
      {value.length.toLocaleString("en-IN")} / {max.toLocaleString("en-IN")}
      {full ? " — limit reached" : ""}
    </p>
  );
}
