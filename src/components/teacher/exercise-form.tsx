"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SELECT = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const MONO = "font-mono text-xs";

type Cell = string | number | boolean | null;

/** A platform sheet, as a teacher may see it. Only the visible half is sent here. */
export interface SheetPreset {
  key: string;
  label: string;
  grid: Cell[][];
}

type Preview =
  | { kind: "sql"; columns: string[]; rows: Cell[][]; hiddenRows: number }
  | { kind: "excel"; value: Cell };

/**
 * Write an SQL or Excel exercise.
 *
 * The answer is what the platform marks against, so it is checked before it
 * is saved: "Check answer" runs it on both datasets and shows what it produced
 * on the visible one, or says what is wrong — it fails, it returns nothing, or
 * it gives the same result on both datasets, which would let a student type
 * the answer in. Saving runs the same checks again on the server.
 *
 * Teachers can use the platform's own data — a small store database for SQL,
 * three sheets for Excel — or bring their own. Bringing their own means two
 * copies with the same columns and different values: the second is the one
 * students never see, and the reason a typed-in answer fails.
 */
export function ExerciseForm({
  kind,
  storeSchemaNote,
  sheets,
}: {
  kind: "sql" | "excel";
  storeSchemaNote: string;
  sheets: SheetPreset[];
}) {
  const [dataset, setDataset] = React.useState(kind === "sql" ? "store" : (sheets[0]?.key ?? "custom"));
  const [busy, setBusy] = React.useState<"check" | "save" | null>(null);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<{ slug: string; title: string } | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const custom = dataset === "custom";
  const sheet = sheets.find((s) => s.key === dataset);

  function payload(checkOnly: boolean) {
    const f = new FormData(formRef.current!);
    const text = (name: string) => String(f.get(name) ?? "");
    const common = {
      kind,
      title: text("title"),
      prompt: text("prompt"),
      topic: text("topic"),
      difficulty: text("difficulty") || "medium",
      hint: text("hint").trim() || null,
      dataset,
      check_only: checkOnly,
    };
    return kind === "sql"
      ? {
          ...common,
          setup_sql: custom ? text("setup_sql") : null,
          hidden_setup_sql: custom ? text("hidden_setup_sql") : null,
          schema_note: custom ? text("schema_note").trim() || null : null,
          solution_sql: text("solution_sql"),
          order_matters: f.get("order_matters") === "on",
        }
      : {
          ...common,
          grid_text: custom ? text("grid_text") : null,
          hidden_grid_text: custom ? text("hidden_grid_text") : null,
          answer_label: text("answer_label").trim() || "the answer cell",
          solution_formula: text("solution_formula"),
        };
  }

  async function send(checkOnly: boolean) {
    if (!formRef.current?.reportValidity()) return;
    setBusy(checkOnly ? "check" : "save");
    setProblem(null);
    try {
      const response = await fetch("/api/teacher/exercises", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload(checkOnly)),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPreview(null);
        setProblem(body.error ?? "Could not check the exercise.");
        return;
      }
      if (checkOnly) {
        const p = body.preview;
        setPreview(
          kind === "sql"
            ? { kind, columns: p.visible.columns, rows: p.visible.rows, hiddenRows: p.hiddenRows }
            : { kind, value: p.visible },
        );
        return;
      }
      toast.success("Exercise saved.");
      setSaved({ slug: body.slug, title: String(new FormData(formRef.current!).get("title") ?? "") });
      formRef.current?.reset();
      setPreview(null);
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(null);
    }
  }

  const noun = kind === "sql" ? "query" : "formula";

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        void send(false);
      }}
      onChange={() => setPreview(null)}
      className="space-y-6"
    >
      {saved && (
        <p className="rounded-md border border-[var(--success)]/40 bg-[var(--success)]/5 px-3 py-2 text-sm">
          Saved &ldquo;{saved.title}&rdquo;.{" "}
          <Link href={`/${kind}/${saved.slug}`} className="underline underline-offset-4">
            Try it yourself
          </Link>
          , or find it — marked &ldquo;Yours&rdquo; — on the{" "}
          <Link href={`/${kind}`} className="underline underline-offset-4">
            {kind === "sql" ? "SQL" : "Excel"} page
          </Link>{" "}
          and tick it to add it to a batch.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <Label htmlFor="ex-title">Title</Label>
          <Input id="ex-title" name="title" required minLength={4} maxLength={200}
            placeholder={kind === "sql" ? "Revenue by city" : "Units sold in the West"} />
        </div>
        <div>
          <Label htmlFor="ex-topic">Topic</Label>
          <Input id="ex-topic" name="topic" required minLength={2} maxLength={60}
            placeholder={kind === "sql" ? "group by" : "sumifs"} />
        </div>
        <div>
          <Label htmlFor="ex-difficulty">Difficulty</Label>
          <select id="ex-difficulty" name="difficulty" defaultValue="medium" className={SELECT}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Data</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(kind === "sql"
            ? [
                { key: "store", label: "The platform's store database", blurb: "customers, products and orders — every platform SQL exercise uses it." },
                { key: "custom", label: "My own data", blurb: "Paste CREATE TABLE and INSERT statements." },
              ]
            : [
                ...sheets.map((s) => ({ key: s.key, label: s.label.split(" — ")[0], blurb: s.label.split(" — ")[1] ?? "" })),
                { key: "custom", label: "My own sheet", blurb: "Paste cells copied from Excel or Google Sheets." },
              ]
          ).map((d) => (
            <label
              key={d.key}
              className={cn(
                "cursor-pointer rounded-lg border p-3 text-sm",
                dataset === d.key ? "border-primary bg-primary/5" : "border-border hover:border-foreground/25",
              )}
            >
              <input
                type="radio"
                name="dataset"
                value={d.key}
                checked={dataset === d.key}
                onChange={() => setDataset(d.key)}
                className="sr-only"
              />
              <span className="font-medium">{d.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{d.blurb}</span>
            </label>
          ))}
        </div>

        {kind === "sql" && !custom && (
          <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">{storeSchemaNote}</pre>
        )}
        {kind === "excel" && sheet && <SheetTable grid={sheet.grid} />}

        {custom && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Give two copies of the data with the same {kind === "sql" ? "tables and columns" : "header row"} and
              different values. Students see only the first. Every answer is also run on the second, so a
              student who types the answer in instead of writing a {noun} is marked wrong.
            </p>
            {kind === "sql" ? (
              <>
                <div>
                  <Label htmlFor="ex-setup">Data students see</Label>
                  <Textarea id="ex-setup" name="setup_sql" rows={8} className={MONO} required
                    placeholder={"create table sales (id integer, region text, amount integer);\ninsert into sales values (1, 'West', 1200), (2, 'East', 800);"} />
                </div>
                <div>
                  <Label htmlFor="ex-hidden">Second dataset — same tables, different rows</Label>
                  <Textarea id="ex-hidden" name="hidden_setup_sql" rows={8} className={MONO} required />
                </div>
                <div>
                  <Label htmlFor="ex-schema">Table description for students (optional)</Label>
                  <Textarea id="ex-schema" name="schema_note" rows={3} className={MONO}
                    placeholder="Left blank, the tables and columns are listed for them." />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="ex-grid">Sheet students see — header row first</Label>
                  <Textarea id="ex-grid" name="grid_text" rows={8} className={MONO} required
                    placeholder={"Region\tRep\tUnits\nWest\tAsha\t12\nEast\tBimal\t30"} />
                </div>
                <div>
                  <Label htmlFor="ex-hidden-grid">Second sheet — same header, different values</Label>
                  <Textarea id="ex-hidden-grid" name="hidden_grid_text" rows={8} className={MONO} required />
                </div>
              </>
            )}
          </div>
        )}
      </fieldset>

      <div>
        <Label htmlFor="ex-prompt">Question</Label>
        <Textarea id="ex-prompt" name="prompt" rows={3} required minLength={10} maxLength={4000}
          placeholder={kind === "sql"
            ? "Return each city with its total revenue from shipped orders, highest first."
            : "In the answer cell, work out the total units sold in the West region."} />
      </div>

      {kind === "excel" && (
        <div>
          <Label htmlFor="ex-answer-label">What the question calls the answer cell</Label>
          <Input id="ex-answer-label" name="answer_label" maxLength={60} defaultValue="the answer cell" />
        </div>
      )}

      <div>
        <Label htmlFor="ex-solution">Your answer {noun}</Label>
        {kind === "sql" ? (
          <Textarea id="ex-solution" name="solution_sql" rows={5} className={MONO} required
            placeholder="select c.city, sum(o.quantity * p.unit_price) as revenue from …" />
        ) : (
          <Input id="ex-solution" name="solution_formula" className={MONO} required
            placeholder='=SUMIFS(E:E, B:B, "West")' />
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Students are marked on whether their {noun} gives the same result as yours on both datasets —
          not on whether it is written the same way. Never shown to students.
        </p>
      </div>

      {kind === "sql" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="order_matters" className="size-4" />
          Row order matters (only if the question asks for an order)
        </label>
      )}

      <div>
        <Label htmlFor="ex-hint">Hint (optional)</Label>
        <Input id="ex-hint" name="hint" maxLength={1000} />
      </div>

      {problem && (
        <p role="alert" className="rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger">
          {problem}
        </p>
      )}
      {preview && <PreviewBox preview={preview} />}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void send(true)}>
          {busy === "check" && <Loader2 className="animate-spin" />}
          Check answer
        </Button>
        <Button type="submit" disabled={busy !== null}>
          {busy === "save" && <Loader2 className="animate-spin" />}
          Save exercise
        </Button>
      </div>
    </form>
  );
}

function PreviewBox({ preview }: { preview: Preview }) {
  return (
    <div className="rounded-md border border-[var(--success)]/40 bg-[var(--success)]/5 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="size-4 text-[var(--success)]" />
        Your answer works on both datasets and tells them apart.
      </p>
      {preview.kind === "excel" ? (
        <p className="mt-2">
          On the sheet students see it gives <span className="font-mono font-medium">{String(preview.value)}</span>.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            On the data students see ({preview.rows.length} row{preview.rows.length === 1 ? "" : "s"};{" "}
            {preview.hiddenRows} on the second dataset):
          </p>
          <div className="mt-1 overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>{preview.columns.map((c, i) => <th key={i} className="px-2 py-1 text-left font-medium">{c}</th>)}</tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-t">
                    {row.map((cell, j) => <td key={j} className="px-2 py-1 font-mono">{cell === null ? "NULL" : String(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** The visible half of a platform sheet, with Excel's column letters. */
function SheetTable({ grid }: { grid: Cell[][] }) {
  const width = Math.max(...grid.map((r) => r.length));
  return (
    <div className="mt-3 max-h-64 overflow-auto rounded-md border">
      <table className="text-xs">
        <thead className="bg-muted">
          <tr>
            <th className="px-2 py-1" />
            {Array.from({ length: width }, (_, i) => (
              <th key={i} className="px-2 py-1 font-mono font-medium">{String.fromCharCode(65 + i)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, r) => (
            <tr key={r} className="border-t">
              <td className="bg-muted px-2 py-1 font-mono text-muted-foreground">{r + 1}</td>
              {row.map((cell, c) => (
                <td key={c} className={cn("px-2 py-1", r === 0 && "font-medium")}>{cell === null ? "" : String(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
