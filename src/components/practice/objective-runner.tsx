"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { cn, formatDuration } from "@/lib/utils";
import {
  OBJECTIVE_SET_SIZE,
  type ObjectiveQuestionForStudent,
  type ObjectiveResultRow,
  type ObjectiveTrackMeta,
} from "@/lib/objective";

interface Results {
  correct: number;
  total: number;
  seconds: number;
  results: ObjectiveResultRow[];
}

/**
 * One objective sitting: draw a set, answer it, get it marked.
 *
 * Note what is NOT here — any notion of which option is right. The set arrives
 * without a key and the key only comes back from the submit route, so there is
 * nothing in the page source, the network tab or React state that a student
 * could read ahead of answering.
 *
 * Unlike the case editor there is no proctoring. A multiple-choice drill is
 * self-directed practice with no mark that counts and nothing to plagiarise:
 * locking the tab would be theatre, and the student who looks up an answer
 * only fools their own accuracy chart.
 */
export function ObjectiveRunner({ track }: { track: ObjectiveTrackMeta }) {
  const router = useRouter();
  const [questions, setQuestions] = React.useState<ObjectiveQuestionForStudent[] | null>(null);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [results, setResults] = React.useState<Results | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const startedAt = React.useRef<number>(0);

  React.useEffect(() => {
    if (!sessionId || results) return;
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [sessionId, results]);

  async function start(difficulty?: "easy" | "medium" | "hard") {
    setBusy(true);
    try {
      const response = await fetch("/api/practice/objective/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          track: track.value,
          difficulty,
          count: OBJECTIVE_SET_SIZE.default,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not start the set.");
        return;
      }
      startedAt.current = Date.now();
      setElapsed(0);
      setAnswers({});
      setResults(null);
      setSessionId(payload.session_id);
      setQuestions(payload.questions);
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!sessionId) return;
    setBusy(true);
    try {
      const response = await fetch("/api/practice/objective/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          answers,
          seconds: Math.floor((Date.now() - startedAt.current) / 1000),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not submit.");
        return;
      }
      setResults(payload);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  // ---- not started --------------------------------------------------------
  if (!questions) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <h2 className="text-lg font-medium">{track.label}</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {track.description} {OBJECTIVE_SET_SIZE.default} questions, marked
            instantly with a worked explanation for every one.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button onClick={() => start()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Mixed set
            </Button>
            {(["easy", "medium", "hard"] as const).map((d) => (
              <Button key={d} variant="outline" disabled={busy} onClick={() => start(d)}>
                {d[0].toUpperCase() + d.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- marked -------------------------------------------------------------
  if (results) {
    const pct = results.total > 0 ? Math.round((results.correct / results.total) * 100) : 0;
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <p className="text-3xl font-medium tabular">
                {results.correct}
                <span className="text-xl text-muted-foreground">/{results.total}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pct}% · {formatDuration(results.seconds)} ·{" "}
                {results.total > 0
                  ? `${Math.round(results.seconds / results.total)}s per question`
                  : "—"}
              </p>
            </div>
            <Button onClick={() => start()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Another set
            </Button>
          </CardContent>
        </Card>

        {results.results.map((r, i) => {
          const right = r.chosen === r.correct_index;
          return (
            <Card key={r.id}>
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
                      {i + 1}. {r.stem}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {r.options.map((opt, idx) => (
                        <li
                          key={idx}
                          className={cn(
                            "rounded px-2 py-1",
                            idx === r.correct_index && "bg-[var(--success)]/10 font-medium",
                            idx === r.chosen &&
                              idx !== r.correct_index &&
                              "bg-destructive/10 line-through",
                          )}
                        >
                          {opt}
                          {idx === r.chosen ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              your answer
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {r.chosen === null ? (
                      <p className="mt-2 text-xs text-muted-foreground">Skipped.</p>
                    ) : null}
                    <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Why: </span>
                      {r.explanation}
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

  // ---- answering ----------------------------------------------------------
  const answered = Object.keys(answers).length;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-lg border bg-background px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Timer className="size-4" />
          <span className="tabular">{formatDuration(elapsed)}</span>
        </span>
        <span className="text-sm text-muted-foreground tabular">
          {answered}/{questions.length} answered
        </span>
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Send />}
          Submit
        </Button>
      </div>

      {questions.map((q, i) => (
        <Card key={q.id}>
          <CardContent className="space-y-3 p-5">
            {q.context ? (
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <Markdown>{q.context}</Markdown>
              </div>
            ) : null}
            <p className="text-sm font-medium">
              {i + 1}. {q.stem}
            </p>
            <div className="space-y-1.5">
              {q.options.map((opt, idx) => {
                const chosen = answers[q.id] === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      chosen
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                        chosen ? "border-action bg-action text-action-foreground" : "border-border",
                      )}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {q.topic} · {q.difficulty}
            </p>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Send />}
          Submit {answered}/{questions.length}
        </Button>
      </div>
    </div>
  );
}
