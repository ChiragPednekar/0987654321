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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ExcelCell } from "@/lib/types/database";

type Verdict = {
  correct: boolean;
  stage?: "refused" | "error" | "visible" | "hidden";
  reason?: string;
  error?: string;
};

/** 1 -> A, 26 -> Z, 27 -> AA. */
function columnName(index: number): string {
  let name = "";
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

function display(value: ExcelCell): string {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

/**
 * The Excel workbench.
 *
 * Same split as the SQL workbench: Run shows what the formula evaluates to on
 * the grid the student can see and says nothing about correctness; Submit is
 * the one that marks, and the one that also evaluates the hidden grid.
 *
 * The grid is drawn with column letters and row numbers because the student is
 * writing references against it — a table with only headers would leave them
 * counting rows to work out that "Units" is C2:C31.
 */
export function ExcelWorkbench({
  slug,
  functions,
  initialFormula,
  alreadySolved,
}: {
  slug: string;
  /** The allow-list. Not part of the exercise, so it may be sent up front. */
  functions: string[];
  initialFormula: string;
  alreadySolved: boolean;
}) {
  const router = useRouter();
  const [formula, setFormula] = React.useState(initialFormula || "=");
  const [value, setValue] = React.useState<{ value: ExcelCell } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [verdict, setVerdict] = React.useState<Verdict | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [showHint, setShowHint] = React.useState(false);
  const [showFunctions, setShowFunctions] = React.useState(false);

  /**
   * Same reasoning as the SQL workbench. The hidden second grid already
   * exposes a typed-in constant, but a formula pasted from a chat window is
   * correct on both grids — the only thing that separates it from the
   * student's own work is that it was never typed.
   */
  const proctor = useProctor(true);

  /**
   * The grid, fetched only once exam mode is armed.
   *
   * It used to be a prop, which meant the entire dataset travelled in the page
   * payload — readable from View Source, so the answer could be worked out in
   * a real spreadsheet before Start was ever pressed. Hiding it behind the
   * gate was not the same as withholding it.
   */
  const [exercise, setExercise] = React.useState<{
    prompt: string;
    grid: ExcelCell[][];
    answer_label: string;
    hint: string | null;
  } | null>(null);
  const [opening, setOpening] = React.useState(false);

  async function beginAttempt() {
    setOpening(true);
    // Before the await, for the transient-activation reason.
    void proctor.start();
    try {
      const response = await fetch("/api/excel/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not open the exercise.");
        return;
      }
      setExercise(payload);
    } catch {
      toast.error("Network error.");
    } finally {
      setOpening(false);
    }
  }

  const empty = !formula.replace(/^=/, "").trim();

  async function run() {
    setBusy(true);
    setVerdict(null);
    setError(null);
    try {
      const response = await fetch("/api/excel/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, formula, signals: proctor.signals }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not run.");
        return;
      }
      if (payload.error) {
        setError(payload.error);
        setValue(null);
        return;
      }
      setValue({ value: payload.value });
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
      const response = await fetch("/api/excel/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, formula }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not submit.");
        return;
      }
      setVerdict(payload);
      if ("value" in payload) setValue({ value: payload.value });
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
   * The grid is the exercise. Rendering it before exam mode is armed would let
   * a student read the data, work the answer out elsewhere and then press
   * Start with nothing recorded.
   */
  if (!proctor.examMode || !exercise) {
    return (
      <ProctorGate
        starting={proctor.starting || opening}
        onStart={beginAttempt}
        title="This exercise is worked under exam conditions"
        rules={WORKBENCH_RULES}
      />
    );
  }

  const width = exercise.grid.reduce(
    (widest, row) => Math.max(widest, row.length),
    0,
  );

  return (
    <div className="space-y-4">
      {proctor.needsAcknowledgement && (
        <ProctorOverlay
          count={proctor.signals.blurCount}
          onResume={proctor.acknowledge}
        />
      )}
      <div className="max-h-[420px] overflow-auto rounded-lg border">
        <table className="border-collapse text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-10 min-w-10 border-b border-r bg-muted px-2 py-1" />
              {Array.from({ length: width }, (_, c) => (
                <th
                  key={c}
                  className="min-w-24 border-b border-r bg-muted px-2 py-1 text-center text-xs font-medium text-muted-foreground"
                >
                  {columnName(c + 1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exercise.grid.map((row, r) => (
              <tr key={r}>
                <td className="sticky left-0 border-b border-r bg-muted px-2 py-1 text-center text-xs text-muted-foreground">
                  {r + 1}
                </td>
                {Array.from({ length: width }, (_, c) => {
                  const cell = row[c] ?? null;
                  return (
                    <td
                      key={c}
                      className={cn(
                        "whitespace-nowrap border-b border-r px-2 py-1",
                        r === 0 && "bg-muted/40 font-medium",
                        typeof cell === "number" && "text-right tabular",
                        typeof cell === "boolean" && "text-center",
                      )}
                    >
                      {display(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {exercise.answer_label} <span className="italic">fx</span>
          </span>
          <Input
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            onPaste={proctor.handlers.onPaste}
            onKeyDown={(e) => {
              proctor.handlers.onKeyDown(e);
              // Enter runs, as it commits a cell in a spreadsheet.
              if (e.key === "Enter" && !busy && !empty) {
                e.preventDefault();
                void (e.metaKey || e.ctrlKey ? submit() : run());
              }
            }}
            spellCheck={false}
            autoComplete="off"
            placeholder='=SUMIFS(C2:C31,A2:A31,"West")'
            className="font-mono text-[13px]"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Enter runs it. {"⌘"}/Ctrl+Enter submits.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowFunctions((v) => !v)}>
              {showFunctions ? "Hide functions" : "Functions"}
            </Button>
            {exercise.hint && (
              <Button size="sm" variant="ghost" onClick={() => setShowHint((v) => !v)}>
                {showHint ? "Hide hint" : "Hint"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={run} disabled={busy || empty}>
              {busy ? <Loader2 className="animate-spin" /> : <Play />}
              Run
            </Button>
            <Button size="sm" onClick={submit} disabled={busy || empty}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />}
              Submit
            </Button>
          </div>
        </div>
        {showFunctions && (
          <p className="rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
            {functions.join(", ")}
          </p>
        )}
        {showHint && exercise.hint && (
          <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            {exercise.hint}
          </p>
        )}
      </div>

      {alreadySolved && !verdict && (
        <p className="text-xs text-[var(--success)]">You have already solved this one.</p>
      )}

      {value && !error && (
        <p className="font-mono text-sm">
          <span className="text-muted-foreground">{exercise.answer_label} = </span>
          {value.value === null ? (
            <span className="text-muted-foreground">(blank)</span>
          ) : (
            display(value.value)
          )}
        </p>
      )}

      {verdict && !verdict.error && (
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
                  ? "Correct — and it works on a second grid too."
                  : verdict.stage === "hidden"
                    ? "Right here, wrong on other numbers"
                    : verdict.stage === "refused"
                      ? "Not available here"
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
    </div>
  );
}
