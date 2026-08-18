import { AlertCircle, ArrowUpRight, CheckCircle2, Quote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EvaluationFeedback, ScoreRow } from "@/lib/types/database";

function scoreTone(percentage: number) {
  if (percentage >= 80) return "text-[var(--success)]";
  if (percentage >= 60) return "text-[var(--warning)]";
  return "text-destructive";
}

export function ScorePanel({
  score,
  criteria,
}: {
  score: ScoreRow;
  criteria: Record<string, number>;
}) {
  const feedback = score.feedback as EvaluationFeedback & { verdict?: string };
  const percentage = Number(score.percentage);

  const sections = [
    {
      key: "strengths" as const,
      title: "Strengths",
      icon: CheckCircle2,
      tone: "text-[var(--success)]",
    },
    {
      key: "weaknesses" as const,
      title: "Where you lost points",
      icon: AlertCircle,
      tone: "text-destructive",
    },
    {
      key: "improvements" as const,
      title: "Next time",
      icon: ArrowUpRight,
      tone: "text-primary",
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total score</p>
              <p className={cn("text-4xl font-semibold tabular", scoreTone(percentage))}>
                {score.total_score}
                <span className="text-xl text-muted-foreground">
                  /{score.max_score}
                </span>
              </p>
            </div>
            <Badge
              variant={
                percentage >= 80 ? "success" : percentage >= 60 ? "warning" : "destructive"
              }
              className="text-sm tabular"
            >
              {percentage.toFixed(0)}%
            </Badge>
          </div>

          <div className="mt-6 space-y-3">
            {Object.entries(criteria).map(([key, max]) => {
              const got = Number(score.breakdown?.[key] ?? 0);
              const ratio = max > 0 ? (got / max) * 100 : 0;
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="capitalize text-muted-foreground">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="tabular">
                      {got}
                      <span className="text-muted-foreground">/{max}</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        ratio >= 80
                          ? "bg-[var(--success)]"
                          : ratio >= 60
                            ? "bg-[var(--warning)]"
                            : "bg-destructive",
                      )}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {feedback?.verdict && (
        <Card>
          <CardContent className="flex gap-3 p-5">
            <Quote className="size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-relaxed">{feedback.verdict}</p>
          </CardContent>
        </Card>
      )}

      {sections.map((section) => {
        const items = feedback?.[section.key] ?? [];
        if (items.length === 0) return null;

        return (
          <Card key={section.key}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <section.icon className={cn("size-4", section.tone)} />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {items.map((item, index) => (
                  <li
                    key={index}
                    className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}

      <p className="text-xs text-muted-foreground">
        Graded by {score.model ?? "AI"} against this case&apos;s rubric. Scores are
        indicative — argue with the feedback, that&apos;s part of the practice.
      </p>
    </div>
  );
}
