"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Play, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useProctor } from "@/hooks/use-proctor";
import {
  ProctorGate,
  ProctorOverlay,
  WORKBENCH_RULES,
} from "@/components/case/proctor-overlay";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ResultSet {
  columns: string[];
  rows: (string | number | null)[][];
}

/**
 * The SQL workbench.
 *
 * Run and Submit are deliberately different actions. Run shows the rows on the
 * data the student can see and says nothing about correctness — they can read
 * the fixture, so pretending to withhold a verdict would be theatre. Submit is
 * the one that marks, and the one that also runs the hidden dataset.
 */
export function SqlWorkbench({
  slug,
  schemaNote,
  orderMatters,
  hint,
  initialQuery,
  alreadySolved,
}: {
  slug: string;
  schemaNote: string;
  orderMatters: boolean;
  hint: string | null;
  initialQuery: string;
  alreadySolved: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState(initialQuery);
  const [result, setResult] = React.useState<ResultSet | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [verdict, setVerdict] = React.useState<
    { correct: boolean; reason?: string; stage?: string } | null
  >(null);
  const [busy, setBusy] = React.useState(false);
  const [showHint, setShowHint] = React.useState(false);

  /**
   * The cheat this blocks is specific: paste a query from a chat window. The
   * hidden second dataset already catches an answer written out as literals,
   * but it cannot tell a correct query someone else wrote from one the student
   * did. Refusing the paste is what makes them type it.
   */
  const proctor = useProctor(true);

  async function run() {
    setBusy(true);
    setVerdict(null);
    setError(null);
    try {
      const response = await fetch("/api/sql/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, query, signals: proctor.signals }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not run.");
        return;
      }
      if (payload.error) {
        setError(payload.error);
        setResult(null);
        return;
      }
      setResult(payload.result);
      if (payload.truncated) {
        toast.warning("Showing the first 500 rows only.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/sql/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, query }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not submit.");
        return;
      }
      setVerdict(payload);
      if (payload.result) setResult(payload.result);
      if (payload.error) setError(payload.error);
      if (payload.integrity_warning) toast.warning(payload.integrity_warning);
      if (payload.correct) {
        toast.success("Correct.");
        proctor.stop();
        router.refresh();
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * The schema and the prompt stay hidden until exam mode is armed, for the
   * same reason the quiz hides its questions: being able to read the exercise
   * before starting is most of what an unsupervised window is worth.
   */
  if (!proctor.examMode) {
    return (
      <ProctorGate
        starting={proctor.starting}
        onStart={proctor.start}
        title="This exercise is worked under exam conditions"
        rules={WORKBENCH_RULES}
      />
    );
  }

  return (
    <div className="space-y-4">
      {proctor.needsAcknowledgement && (
        <ProctorOverlay
          count={proctor.signals.blurCount}
          onResume={proctor.acknowledge}
        />
      )}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Schema
          </p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
            {schemaNote}
          </pre>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPaste={proctor.handlers.onPaste}
          onKeyDown={(e) => {
            proctor.handlers.onKeyDown(e);
            // Cmd/Ctrl+Enter runs, which is what every SQL client does.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void run();
            }
          }}
          spellCheck={false}
          placeholder="select ..."
          className="min-h-[160px] resize-y font-mono text-[13px] leading-relaxed"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {orderMatters
              ? "Row order matters for this one — write an ORDER BY."
              : "Row order does not matter. Column names do not either."}
          </p>
          <div className="flex gap-2">
            {hint && (
              <Button size="sm" variant="ghost" onClick={() => setShowHint((v) => !v)}>
                {showHint ? "Hide hint" : "Hint"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={run} disabled={busy || !query.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <Play />}
              Run
            </Button>
            <Button size="sm" onClick={submit} disabled={busy || !query.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />}
              Submit
            </Button>
          </div>
        </div>
        {showHint && hint && (
          <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>

      {alreadySolved && !verdict && (
        <p className="text-xs text-[var(--success)]">You have already solved this one.</p>
      )}

      {verdict && (
        <Card
          className={cn(
            verdict.correct ? "border-[var(--success)]/40" : "border-destructive/40",
          )}
        >
          <CardContent className="flex items-start gap-2.5 p-4">
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                verdict.correct
                  ? "bg-[var(--success)]/15 text-[var(--success)]"
                  : "bg-destructive/15 text-destructive",
              )}
            >
              {verdict.correct ? <Check className="size-3" /> : <X className="size-3" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {verdict.correct
                  ? "Correct — and it works on a second dataset too."
                  : verdict.stage === "hidden"
                    ? "Right here, wrong on other data"
                    : "Not right yet"}
              </p>
              {verdict.reason && (
                <p className="mt-1 text-xs text-muted-foreground">{verdict.reason}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4">
            <p className="font-mono text-xs text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {result.columns.map((c, i) => (
                  <th key={i} className="whitespace-nowrap px-3 py-2 text-left font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="border-t">
                  {row.map((cell, j) => (
                    <td key={j} className="whitespace-nowrap px-3 py-1.5 tabular">
                      {cell === null ? (
                        <span className="text-muted-foreground">null</span>
                      ) : (
                        String(cell)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {result.rows.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">No rows.</p>
          )}
        </div>
      )}
    </div>
  );
}
