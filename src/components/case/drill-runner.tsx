"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Flag, Loader2, Timer, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn, formatDuration } from "@/lib/utils";
import type { DrillResult } from "@/app/api/drills/submit/route";

export interface DrillQuestion {
  id: string;
  position: number;
  prompt: string;
  tolerance_pct: number;
  unit: string | null;
}

export function DrillRunner({
  caseId,
  questions,
  signedIn,
  caseSlug,
}: {
  caseId: string;
  questions: DrillQuestion[];
  signedIn: boolean;
  caseSlug: string;
}) {
  const [current, setCurrent] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [flagged, setFlagged] = React.useState<Set<string>>(new Set());
  const [elapsed, setElapsed] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<DrillResult | null>(null);
  const startedAt = React.useRef(Date.now());

  React.useEffect(() => {
    if (result) return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [result]);

  const answeredCount = questions.filter((q) =>
    answers[q.id]?.trim(),
  ).length;

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function toggleFlag(id: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!signedIn) {
      toast.error("Log in to submit a drill.");
      return;
    }

    setSubmitting(true);
    try {
      // Only send parsable numbers; blanks are simply omitted.
      const numeric: Record<string, number> = {};
      for (const [id, raw] of Object.entries(answers)) {
        const value = Number(raw.replace(/,/g, "").trim());
        if (raw.trim() && Number.isFinite(value)) numeric[id] = value;
      }

      const response = await fetch("/api/drills/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          duration_seconds: Math.floor((Date.now() - startedAt.current) / 1000),
          answers: numeric,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not submit drill.");
        return;
      }

      setResult(payload);
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- results ------------------------------------------------------------
  if (result) {
    const pct = Math.round((result.correct / result.total) * 100);

    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm text-muted-foreground">Score</p>
              <p className="text-2xl font-semibold tabular">
                {result.correct}/{result.total}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {pct}%
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Time</p>
              <p className="text-lg font-medium tabular">
                {formatDuration(elapsed)}
              </p>
            </div>
          </CardContent>
        </Card>

        <ul className="space-y-2">
          {result.questions.map((q) => {
            const source = questions.find((item) => item.id === q.id);
            return (
              <li key={q.id}>
                <Card className={cn(!q.correct && "border-destructive/40")}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2.5">
                      {q.correct ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
                      ) : (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{source?.prompt}</p>
                        <p className="mt-1.5 text-xs text-muted-foreground tabular">
                          You: {q.answered ?? "—"} · Expected: {q.expected}
                          {q.unit ? ` ${q.unit}` : ""}
                        </p>
                        {q.explanation && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/cases/${caseSlug}`}>Try again</Link>
          </Button>
          <Button asChild>
            <Link href="/cases?format=drill">More drills</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ---- runner -------------------------------------------------------------
  const question = questions[current];
  if (!question) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {questions.map((q, index) => {
            const answered = Boolean(answers[q.id]?.trim());
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrent(index)}
                aria-label={`Question ${q.position}`}
                aria-current={index === current}
                className={cn(
                  "size-8 rounded-md border text-xs font-medium transition-colors",
                  index === current
                    ? "border-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:text-foreground",
                  answered && index !== current && "bg-muted",
                  flagged.has(q.id) && "ring-1 ring-[var(--warning)]",
                )}
              >
                {q.position}
              </button>
            );
          })}
        </div>

        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Timer className="size-3.5" />
          <span className="tabular">{formatDuration(elapsed)}</span>
        </span>
      </div>

      <Progress value={(answeredCount / questions.length) * 100} />
      <p className="text-xs text-muted-foreground tabular">
        {answeredCount}/{questions.length} answered
      </p>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm leading-relaxed">{question.prompt}</p>
            <button
              type="button"
              onClick={() => toggleFlag(question.id)}
              aria-pressed={flagged.has(question.id)}
              className={cn(
                "shrink-0 rounded-md p-1.5 transition-colors",
                flagged.has(question.id)
                  ? "text-[var(--warning)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Flag this question"
            >
              <Flag className="size-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Input
              // `inputMode` keeps a numeric keypad on mobile without blocking
              // minus signs or decimals the way type="number" can.
              inputMode="decimal"
              value={answers[question.id] ?? ""}
              onChange={(event) => setAnswer(question.id, event.target.value)}
              placeholder="Your answer"
              className="max-w-[220px] font-mono"
              autoFocus
            />
            {question.unit && (
              <span className="text-sm text-muted-foreground">
                {question.unit}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              ±{question.tolerance_pct}% accepted
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          disabled={current === 0}
          onClick={() => setCurrent((i) => i - 1)}
        >
          Previous
        </Button>

        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent((i) => i + 1)}>Next</Button>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            Submit drill
          </Button>
        )}
      </div>
    </div>
  );
}
