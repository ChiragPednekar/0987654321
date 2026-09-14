"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface QuizQuestion {
  position: number;
  stem: string;
  options: string[];
  isPulled: boolean;
}

export interface Review {
  score: { correct: number; total: number };
  questions: {
    position: number;
    stem: string;
    options: string[];
    chosen: number;
    correctIndex: number;
    explanation: string;
    evidence: string;
    isPulled: boolean;
    source: { title: string; url: string; publishedAt: string } | null;
  }[];
}

function ReviewView({ review }: { review: Review }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <p className="text-3xl font-semibold tabular">
            {review.score.correct}
            <span className="text-xl text-muted-foreground">/{review.score.total}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every answer below links to the press release it came from.
          </p>
        </CardContent>
      </Card>

      {review.questions.map((q, i) => {
        const right = q.chosen === q.correctIndex;
        if (q.isPulled) {
          return (
            <Card key={q.position} className="border-dashed">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">
                  {i + 1}. Removed by the editors after publication. It does not count
                  toward anyone&apos;s score.
                </p>
              </CardContent>
            </Card>
          );
        }
        return (
          <Card key={q.position}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                    right
                      ? "bg-[var(--success)]/15 text-[var(--success)]"
                      : "bg-destructive/15 text-destructive",
                  )}
                >
                  {right ? <Check className="size-3" /> : <X className="size-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {i + 1}. {q.stem}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {q.options.map((opt, idx) => (
                      <li
                        key={idx}
                        className={cn(
                          "rounded px-2 py-1",
                          idx === q.correctIndex && "bg-[var(--success)]/10 font-medium",
                          idx === q.chosen && idx !== q.correctIndex && "bg-destructive/10 line-through",
                        )}
                      >
                        {opt}
                        {idx === q.chosen && (
                          <span className="ml-2 text-xs text-muted-foreground">your answer</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {q.chosen === -1 && <p className="mt-2 text-xs text-muted-foreground">Skipped.</p>}
                  <div className="mt-3 space-y-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Why: </span>
                      {q.explanation}
                    </p>
                    <blockquote className="border-l-2 pl-2 italic">“{q.evidence}”</blockquote>
                    {q.source && (
                      <a
                        href={q.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {q.source.title}
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * One day's quiz.
 *
 * All questions on one screen and one submit, rather than one at a time: five
 * questions is a two-minute habit, and a student who has to click through a
 * wizard every morning stops coming back.
 */
export function DailyQuiz({
  quizId,
  questions,
  initialReview,
  entitled,
}: {
  quizId: string;
  questions: QuizQuestion[];
  initialReview: Review | null;
  entitled: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [review, setReview] = React.useState<Review | null>(initialReview);
  const [busy, setBusy] = React.useState(false);

  if (review) return <ReviewView review={review} />;

  const live = questions.filter((q) => !q.isPulled);
  const answered = live.filter((q) => answers[q.position] !== undefined).length;

  async function submit() {
    if (answered < live.length && !window.confirm(`Submit with ${live.length - answered} unanswered?`)) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/daily/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quiz_id: quizId,
          answers: questions.map((q) => answers[q.position] ?? -1),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not submit.");
        return;
      }
      setReview(payload.review);
      if (payload.repeat) toast.info("You had already answered this quiz. Showing your first attempt.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {live.map((q, i) => (
        <Card key={q.position}>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium">
              {i + 1}. {q.stem}
            </p>
            <div className="space-y-1.5">
              {q.options.map((opt, idx) => {
                const chosen = answers[q.position] === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!entitled}
                    onClick={() => setAnswers((a) => ({ ...a, [q.position]: idx }))}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed",
                      chosen ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                        chosen ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {entitled
            ? "One attempt. The answers, and the release each one came from, appear when you submit."
            : "The daily quiz is available to licensed accounts. Ask your college to activate CaseCode."}
        </p>
        <Button onClick={submit} disabled={busy || !entitled || answered === 0}>
          {busy ? <Loader2 className="animate-spin" /> : <Send />}
          Submit {answered}/{live.length}
        </Button>
      </div>
    </div>
  );
}
