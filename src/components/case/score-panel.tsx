import { AlertCircle, ArrowUpRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EvaluationFeedback, ScoreRow } from "@/lib/types/database";

function tone(percentage: number) {
  if (percentage >= 80) return "success";
  if (percentage >= 60) return "warning";
  return "destructive";
}

const TONE_TEXT = {
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  destructive: "text-destructive",
} as const;

const TONE_BG = {
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  destructive: "bg-destructive",
} as const;

/**
 * The result screen — the moment the whole product exists to deliver.
 *
 * It used to be four stacked cards: a number, a quote, and three bulleted
 * lists that looked identical to each other. Everything had the same weight, so
 * the score, the verdict and the advice all arrived at once and none of them
 * landed.
 *
 * Now there is one clear order. A score ring you can read at a glance, the
 * criteria beneath it as a small table of bars, the verdict as the one piece of
 * prose on the screen, and the three feedback lists sharing a single card with
 * coloured rails so they read as one critique rather than three sections.
 */
export function ScorePanel({
  score,
  criteria,
}: {
  score: ScoreRow;
  criteria: Record<string, number>;
}) {
  const feedback = score.feedback as EvaluationFeedback & {
    verdict?: string;
    hint_penalty_pct?: number;
    integrity?: {
      severity: "clean" | "suspect" | "severe";
      penalty_pct: number;
      flags: string[];
    };
  };

  /**
   * A deduction the student cannot see is an accusation, not a process. So the
   * flags are listed in full — including the ones that cost nothing — and the
   * appeal route is named on the same card. Shown only when the mark was
   * actually reduced; a clean submission should not be handed a report on its
   * own honesty.
   */
  const integrity =
    feedback?.integrity && feedback.integrity.penalty_pct > 0
      ? feedback.integrity
      : null;
  const percentage = Number(score.percentage);
  const t = tone(percentage);

  // A ring reads as a proportion without needing to be measured, which a bare
  // "63/80" does not. 44px radius, so the circumference is the dash length.
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  const sections = [
    {
      key: "strengths" as const,
      title: "Strengths",
      icon: CheckCircle2,
      text: "text-[var(--success)]",
      rail: "bg-[var(--success)]/40",
    },
    {
      key: "weaknesses" as const,
      title: "Where you lost points",
      icon: AlertCircle,
      text: "text-destructive",
      rail: "bg-destructive/40",
    },
    {
      key: "improvements" as const,
      title: "Next time",
      icon: ArrowUpRight,
      text: "text-primary",
      rail: "bg-primary/40",
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        {/* A hairline of the score colour, so the verdict is legible before a
            single number is read. */}
        <div className={cn("h-1 w-full", TONE_BG[t])} />

        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative shrink-0 self-center sm:self-auto">
              <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden>
                <circle
                  cx="56"
                  cy="56"
                  r={radius}
                  fill="none"
                  strokeWidth="8"
                  className="stroke-muted"
                />
                <circle
                  cx="56"
                  cy="56"
                  r={radius}
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${filled} ${circumference}`}
                  transform="rotate(-90 56 56)"
                  className={cn("transition-all", {
                    "stroke-[var(--success)]": t === "success",
                    "stroke-[var(--warning)]": t === "warning",
                    "stroke-destructive": t === "destructive",
                  })}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={cn(
                    "text-2xl font-semibold leading-none tabular",
                    TONE_TEXT[t],
                  )}
                >
                  {percentage.toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Total score
              </p>
              <p className="mt-1 text-4xl font-semibold leading-none tracking-tight tabular">
                {score.total_score}
                <span className="text-2xl text-muted-foreground">
                  /{score.max_score}
                </span>
              </p>
              {feedback?.verdict && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {feedback.verdict}
                </p>
              )}
            </div>
          </div>

          {integrity && (
            <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-medium">
                    Marked down {integrity.penalty_pct}% for academic integrity
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {integrity.flags.map((flag) => (
                      <li key={flag}>· {flag}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    The score above already includes this deduction. If you
                    believe it is wrong, ask your teacher or placement cell to
                    review it — they can clear it and restore the full mark.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3 border-t border-border pt-5">
            {Object.entries(criteria).map(([key, max]) => {
              const got = Number(score.breakdown?.[key] ?? 0);
              const ratio = max > 0 ? (got / max) * 100 : 0;
              const ct = tone(ratio);
              return (
                <div
                  key={key}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,10rem)_1fr_auto]"
                >
                  <span className="truncate text-sm capitalize text-muted-foreground">
                    {key.replace(/_/g, " ")}
                  </span>
                  <div className="col-span-2 h-2 overflow-hidden rounded-full bg-muted sm:col-span-1 sm:order-none">
                    <div
                      className={cn("h-full rounded-full", TONE_BG[ct])}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                  <span className="text-sm tabular sm:order-none">
                    {got}
                    <span className="text-muted-foreground">/{max}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* One card, three rails — a single critique rather than three lookalike
          boxes competing for the same attention. */}
      {sections.some((s) => (feedback?.[s.key] ?? []).length > 0) && (
        <Card>
          <CardContent className="space-y-5 p-6">
            {sections.map((section) => {
              const items = feedback?.[section.key] ?? [];
              if (items.length === 0) return null;
              return (
                <div key={section.key}>
                  <h3
                    className={cn(
                      "flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider",
                      section.text,
                    )}
                  >
                    <section.icon className="size-3.5" />
                    {section.title}
                  </h3>
                  <ul className="mt-2.5 space-y-2.5 pl-0.5">
                    {items.map((item, index) => (
                      <li key={index} className="flex gap-3">
                        <span
                          className={cn(
                            "mt-1 w-0.5 shrink-0 self-stretch rounded-full",
                            section.rail,
                          )}
                        />
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {item}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Graded by {score.model ?? "AI"} against this case&apos;s rubric. Scores are
        indicative — argue with the feedback, that&apos;s part of the practice.
      </p>
    </div>
  );
}
