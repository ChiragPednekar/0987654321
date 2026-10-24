"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CheckQuestionView {
  id: string;
  question: string;
  options: string[];
}

interface Result {
  id: string;
  chosen: number;
  answer: number;
  correct: boolean;
  explanation: string;
}

/**
 * A module's knowledge check. Passing it (3 of 4) is what completes the
 * module; the server grades it and records the pass (075). Retakes are
 * allowed, and each answer is explained once graded.
 */
export function ModuleCheck({
  examSlug,
  moduleId,
  questions,
  passed,
  signedIn,
  onPassed,
}: {
  examSlug: string;
  moduleId: string;
  questions: CheckQuestionView[];
  passed: boolean;
  signedIn: boolean;
  onPassed: (moduleId: string) => void;
}) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<number[]>(() => questions.map(() => -1));
  const [results, setResults] = React.useState<Result[] | null>(null);
  const [score, setScore] = React.useState<{ correct: number; total: number; passed: boolean } | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (!signedIn) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link href={`/login?next=/certificates/${examSlug}`} className="text-foreground underline underline-offset-4">
          Sign in
        </Link>{" "}
        to take this module&apos;s knowledge check.
      </p>
    );
  }

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch(`/api/certificates/courses/${examSlug}/check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ moduleId, answers }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error ?? "Could not check your answers.");
        return;
      }
      setResults(payload.results);
      setScore({ correct: payload.correct, total: payload.total, passed: payload.passed });
      if (payload.passed) {
        toast.success("Module passed.");
        onPassed(moduleId);
        router.refresh();
      } else {
        toast.error(`${payload.correct} of ${payload.total} — read the explanations and try again.`);
      }
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    setResults(null);
    setScore(null);
    setAnswers(questions.map(() => -1));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Knowledge check · pass {Math.ceil(questions.length * 0.75)} of {questions.length}
        </p>
        {passed && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" /> Passed
          </span>
        )}
      </div>

      <ol className="space-y-5">
        {questions.map((question, qi) => {
          const result = results?.find((r) => r.id === question.id);
          return (
            <li key={question.id}>
              <p className="text-sm font-medium">
                {qi + 1}. {question.question}
              </p>
              <div className="mt-2 grid gap-1.5">
                {question.options.map((option, oi) => {
                  const chosen = answers[qi] === oi;
                  const isAnswer = result && result.answer === oi;
                  const wrongPick = result && chosen && !result.correct;
                  return (
                    <label
                      key={oi}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 border px-3 py-2 text-sm transition-colors",
                        result
                          ? isAnswer
                            ? "border-emerald-500/60 bg-emerald-500/5"
                            : wrongPick
                              ? "border-rose-500/60 bg-rose-500/5"
                              : "border-border opacity-70"
                          : chosen
                            ? "border-brand bg-brand-surface"
                            : "border-border hover:border-brand-border",
                      )}
                    >
                      <input
                        type="radio"
                        name={`${moduleId}-${question.id}`}
                        className="mt-1"
                        checked={chosen}
                        disabled={Boolean(results)}
                        onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
              {result && (
                <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                  {result.correct ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
                  )}
                  {result.explanation}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        {results ? (
          <>
            <p className={cn("text-sm font-medium", score?.passed ? "text-emerald-600 dark:text-emerald-400" : "")}>
              {score?.correct} of {score?.total} correct — {score?.passed ? "module passed" : "not yet"}
            </p>
            {!score?.passed && (
              <Button size="sm" variant="ink" onClick={retry}>
                Try again
              </Button>
            )}
          </>
        ) : (
          <Button size="sm" variant="ink" onClick={submit} disabled={busy || answers.some((a) => a < 0)}>
            {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            {passed ? "Retake the check" : "Check my answers"}
          </Button>
        )}
      </div>
    </div>
  );
}
