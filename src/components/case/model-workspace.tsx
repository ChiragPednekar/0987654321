"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Timer, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn, formatDuration } from "@/lib/utils";
import type { ModelResult } from "@/app/api/model/submit/route";

export interface ModelCell {
  id: string;
  row_index: number;
  col_index: number;
  label: string;
  tolerance_pct: number;
  unit: string | null;
}

/**
 * Spreadsheet build surface (spec §5).
 *
 * A real grid rather than a list of inputs: a model is read in two dimensions,
 * and arrow-key movement between cells is what makes it feel like a
 * spreadsheet instead of a form. Grading is arithmetic and happens server-side
 * — see /api/model/submit.
 */
export function ModelWorkspace({
  caseId,
  cells,
  signedIn,
  caseSlug,
}: {
  caseId: string;
  cells: ModelCell[];
  signedIn: boolean;
  caseSlug: string;
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [elapsed, setElapsed] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<ModelResult | null>(null);
  const startedAt = React.useRef(Date.now());
  const inputs = React.useRef(new Map<string, HTMLInputElement>());

  React.useEffect(() => {
    if (result) return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [result]);

  // Group into rows, and work out how wide the grid is, so the header and each
  // row agree on column count even when a row has gaps.
  const { rows, colCount } = React.useMemo(() => {
    const byRow = new Map<number, ModelCell[]>();
    let maxCol = 0;
    for (const cell of cells) {
      if (!byRow.has(cell.row_index)) byRow.set(cell.row_index, []);
      byRow.get(cell.row_index)!.push(cell);
      maxCol = Math.max(maxCol, cell.col_index);
    }
    return {
      rows: [...byRow.entries()].sort((a, b) => a[0] - b[0]),
      colCount: maxCol + 1,
    };
  }, [cells]);

  const filled = cells.filter((c) => values[c.id]?.trim()).length;

  function cellAt(row: number, col: number) {
    return cells.find((c) => c.row_index === row && c.col_index === col);
  }

  /** Arrow keys and Enter move between cells, as a spreadsheet would. */
  function onKeyDown(event: React.KeyboardEvent, cell: ModelCell) {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      Enter: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const move = moves[event.key];
    if (!move) return;

    // Left/right should still move the caret within a partially typed number.
    const input = event.target as HTMLInputElement;
    if (
      (event.key === "ArrowLeft" && input.selectionStart !== 0) ||
      (event.key === "ArrowRight" && input.selectionStart !== input.value.length)
    ) {
      return;
    }

    const target = cellAt(cell.row_index + move[0], cell.col_index + move[1]);
    if (!target) return;
    event.preventDefault();
    inputs.current.get(target.id)?.focus();
    inputs.current.get(target.id)?.select();
  }

  async function submit() {
    if (!signedIn) {
      toast.error("Log in to submit a model.");
      return;
    }

    const numeric: Record<string, number> = {};
    for (const cell of cells) {
      const raw = values[cell.id]?.trim();
      if (!raw) continue;
      // Accept 1,200 and 1200 alike — people paste from spreadsheets.
      const parsed = Number(raw.replace(/,/g, ""));
      if (Number.isFinite(parsed)) numeric[cell.id] = parsed;
    }

    if (Object.keys(numeric).length === 0) {
      toast.error("Fill in at least one cell first.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/model/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          cells: numeric,
          duration_seconds: elapsed,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not submit the model.");
        return;
      }
      setResult(payload as ModelResult);
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  const graded = result
    ? new Map(result.cells.map((c) => [c.id, c]))
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Timer className="size-4" />
          <span className="tabular">{formatDuration(elapsed)}</span>
        </div>
        <div className="flex-1">
          <Progress value={(filled / cells.length) * 100} />
        </div>
        <span className="text-sm text-muted-foreground tabular">
          {filled} / {cells.length}
        </span>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-10 px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                  #
                </th>
                {Array.from({ length: colCount }, (_, col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {/* Spreadsheet-style column letters. */}
                    {String.fromCharCode(65 + col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([rowIndex, rowCells]) => (
                <tr key={rowIndex} className="border-b border-border last:border-0">
                  <td className="px-2 py-1 text-xs text-muted-foreground tabular">
                    {rowIndex + 1}
                  </td>
                  {Array.from({ length: colCount }, (_, col) => {
                    const cell = rowCells.find((c) => c.col_index === col);
                    if (!cell) {
                      return <td key={col} className="px-3 py-1" />;
                    }
                    const outcome = graded?.get(cell.id);
                    return (
                      <td key={col} className="px-3 py-1 align-top">
                        <label
                          htmlFor={`cell-${cell.id}`}
                          className="block text-[11px] text-muted-foreground"
                        >
                          {cell.label}
                          {cell.unit ? (
                            <span className="ml-1 opacity-70">({cell.unit})</span>
                          ) : null}
                        </label>
                        <input
                          id={`cell-${cell.id}`}
                          ref={(el) => {
                            if (el) inputs.current.set(cell.id, el);
                            else inputs.current.delete(cell.id);
                          }}
                          inputMode="decimal"
                          disabled={!!result}
                          value={values[cell.id] ?? ""}
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              [cell.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => onKeyDown(e, cell)}
                          className={cn(
                            "mt-0.5 w-28 rounded-md border bg-background px-2 py-1 font-mono text-sm tabular",
                            "focus:outline-none focus:ring-2 focus:ring-ring",
                            outcome
                              ? outcome.correct
                                ? "border-emerald-500/60 text-emerald-600 dark:text-emerald-400"
                                : "border-rose-500/60 text-rose-600 dark:text-rose-400"
                              : "border-input",
                          )}
                        />
                        {outcome && !outcome.correct ? (
                          <p className="mt-1 text-[11px] text-muted-foreground tabular">
                            expected {outcome.expected.toLocaleString()}
                          </p>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {!result ? (
        <Button onClick={submit} disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : null}
          Submit model
        </Button>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-semibold tabular">
                {result.correct} / {result.total}
              </span>
              <span className="text-sm text-muted-foreground">
                cells within tolerance in {formatDuration(elapsed)}
              </span>
            </div>

            <ul className="space-y-3">
              {result.cells.map((cell) => (
                <li key={cell.id} className="flex gap-3 text-sm">
                  {cell.correct ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{cell.label}</p>
                    <p className="text-muted-foreground tabular">
                      you {cell.answered?.toLocaleString() ?? "—"} · expected{" "}
                      {cell.expected.toLocaleString()}
                      {cell.unit ? ` ${cell.unit}` : ""}
                    </p>
                    {cell.formula ? (
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {cell.formula}
                      </p>
                    ) : null}
                    {cell.explanation ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {cell.explanation}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            <Button asChild variant="outline" size="sm">
              <Link href={`/cases/${caseSlug}`}>Try again</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
