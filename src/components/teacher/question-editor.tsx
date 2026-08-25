"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { DOMAINS, DIFFICULTIES } from "@/lib/constants";
import { QuestionUpload, type ParsedQuestion } from "@/components/teacher/question-upload";
import { cn } from "@/lib/utils";

interface Criterion {
  key: string;
  label: string;
  weight: number;
  descriptor: string;
}

const DEFAULT_RUBRIC: Criterion[] = [
  { key: "financial_analysis", label: "Financial analysis", weight: 30, descriptor: "" },
  { key: "market_analysis", label: "Market analysis", weight: 20, descriptor: "" },
  { key: "risk_assessment", label: "Risk assessment", weight: 25, descriptor: "" },
  { key: "recommendation", label: "Recommendation", weight: 25, descriptor: "" },
];

/**
 * Teacher question editor (spec §12).
 *
 * The rubric is not optional and the running total is always visible, because
 * the weights are the denominator of every score on this question — a teacher
 * should see what they add up to before publishing, not discover it from a
 * student's result.
 */
export function QuestionEditor({
  batches,
}: {
  batches: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [criteria, setCriteria] = React.useState<Criterion[]>(DEFAULT_RUBRIC);
  const [hints, setHints] = React.useState<string[]>([]);

  // Only the fields an upload can fill are controlled. The rest stay
  // uncontrolled, because nothing outside the form ever needs to set them.
  const [filled, setFilled] = React.useState({
    title: "",
    scenario: "",
    instructions: "",
    expected_framework: "",
    model_answer: "",
  });

  /**
   * An upload fills the form; it never publishes. The rubric is deliberately
   * left alone — the spec requires the teacher to define it, and a guessed
   * rubric is worse than an empty one because it looks considered.
   */
  function applyParsed(parsed: ParsedQuestion) {
    setFilled({
      title: parsed.title ?? "",
      scenario: parsed.scenario,
      instructions: parsed.instructions ?? "",
      expected_framework: parsed.expectedFramework ?? "",
      model_answer: parsed.modelAnswer ?? "",
    });
  }

  function field(name: keyof typeof filled) {
    return {
      value: filled[name],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setFilled((prev) => ({ ...prev, [name]: e.target.value })),
    };
  }

  const total = criteria.reduce((a, c) => a + (Number(c.weight) || 0), 0);

  function update(i: number, patch: Partial<Criterion>) {
    setCriteria((prev) => prev.map((c, n) => (n === i ? { ...c, ...patch } : c)));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>, publish: boolean) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);

    const cleaned = criteria
      .filter((c) => c.label.trim() && Number(c.weight) > 0)
      .map((c) => ({
        key:
          c.key.trim() ||
          c.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60),
        label: c.label.trim(),
        weight: Number(c.weight),
        descriptor: c.descriptor.trim() || undefined,
      }));

    if (cleaned.length === 0) {
      toast.error("Add at least one rubric criterion.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/teacher/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: String(f.get("title") ?? ""),
          classroom_id: String(f.get("classroom_id") ?? ""),
          domain: String(f.get("domain") ?? "consulting"),
          difficulty: String(f.get("difficulty") ?? "medium"),
          format: String(f.get("format") ?? "full_case"),
          scenario: String(f.get("scenario") ?? ""),
          instructions: String(f.get("instructions") ?? ""),
          expected_framework: String(f.get("expected_framework") ?? "") || null,
          model_answer: String(f.get("model_answer") ?? "") || null,
          hints: hints
            .filter((h) => h.trim())
            .map((h) => ({ body: h.trim(), penalty_pct: 10 })),
          rubric: cleaned,
          is_published: publish,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? "Could not save the question.");
        return;
      }
      toast.success(publish ? "Question published." : "Draft saved.");
      router.push("/teacher/questions");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (batches.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          You need a batch before you can write a question — a question belongs
          to the batch it was written for.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <QuestionUpload onParsed={applyParsed} />

      <form onSubmit={(e) => submit(e, true)} className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Basics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required minLength={4} maxLength={200}
              placeholder="Northwind Retail: Why Are Margins Falling?"
              {...field("title")} />
          </div>
          <div>
            <Label htmlFor="classroom_id">Batch</Label>
            <select
              id="classroom_id" name="classroom_id" required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Only this batch can see it.
            </p>
          </div>
          <div>
            <Label htmlFor="format">Format</Label>
            <select id="format" name="format"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="full_case">Full case</option>
              <option value="framework">Framework only</option>
              <option value="debug">Debug — find the flaw</option>
            </select>
          </div>
          <div>
            <Label htmlFor="domain">Domain</Label>
            <select id="domain" name="domain"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="difficulty">Difficulty</Label>
            <select id="difficulty" name="difficulty" defaultValue="medium"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          The case
        </h2>
        <div>
          <Label htmlFor="scenario">Scenario</Label>
          <Textarea id="scenario" name="scenario" required rows={10} minLength={50}
            placeholder="The situation, the numbers, and what the client wants to know. Markdown works."
            {...field("scenario")} />
        </div>
        <div>
          <Label htmlFor="instructions">What the student must do</Label>
          <Textarea id="instructions" name="instructions" required rows={3} minLength={10}
            {...field("instructions")} />
        </div>
        <div>
          <Label htmlFor="expected_framework">Strong approaches (optional)</Label>
          <Textarea id="expected_framework" name="expected_framework" rows={2}
            {...field("expected_framework")} />
        </div>
        <div>
          <Label htmlFor="model_answer">Reference answer (optional)</Label>
          <Textarea id="model_answer" name="model_answer" rows={6}
            placeholder="Students never see this. It is given to the grader as a strong example, not the only correct one."
            {...field("model_answer")} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Hints
        </h2>
        <p className="text-xs text-muted-foreground">
          Revealed one at a time, each costing the student part of their score.
        </p>
        {hints.map((h, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={h}
              onChange={(e) =>
                setHints((prev) => prev.map((v, n) => (n === i ? e.target.value : v)))
              }
              placeholder={`Hint ${i + 1}`}
            />
            <Button type="button" variant="ghost" size="icon"
              onClick={() => setHints((prev) => prev.filter((_, n) => n !== i))}>
              <X className="size-4" />
              <span className="sr-only">Remove hint {i + 1}</span>
            </Button>
          </div>
        ))}
        {hints.length < 5 ? (
          <Button type="button" variant="outline" size="sm"
            onClick={() => setHints((prev) => [...prev, ""])}>
            <Plus className="size-4" />
            Add hint
          </Button>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Rubric
          </h2>
          <span className={cn(
            "text-sm tabular",
            total === 0 ? "text-rose-500" : "text-muted-foreground",
          )}>
            totals {total} points
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Each criterion is clamped to its weight and the total recomputed by the
          platform — the model never decides the final number.
        </p>

        {criteria.map((c, i) => (
          <div key={i} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_6rem_auto]">
            <div>
              <Label htmlFor={`crit-${i}`} className="sr-only">Criterion {i + 1}</Label>
              <Input id={`crit-${i}`} value={c.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Criterion name" />
              <Input className="mt-2" value={c.descriptor}
                onChange={(e) => update(i, { descriptor: e.target.value })}
                placeholder="What a strong answer looks like (optional)" />
            </div>
            <div>
              <Label htmlFor={`w-${i}`} className="sr-only">Weight</Label>
              <Input id={`w-${i}`} type="number" min={1} max={100} value={c.weight}
                onChange={(e) => update(i, { weight: Number(e.target.value) })} />
            </div>
            <Button type="button" variant="ghost" size="icon"
              onClick={() => setCriteria((prev) => prev.filter((_, n) => n !== i))}>
              <X className="size-4" />
              <span className="sr-only">Remove criterion</span>
            </Button>
          </div>
        ))}

        {criteria.length < 8 ? (
          <Button type="button" variant="outline" size="sm"
            onClick={() =>
              setCriteria((prev) => [...prev, { key: "", label: "", weight: 10, descriptor: "" }])
            }>
            <Plus className="size-4" />
            Add criterion
          </Button>
        ) : null}
      </section>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Publish question
        </Button>
        <Button type="button" variant="outline" disabled={busy}
          onClick={(e) => {
            const form = (e.currentTarget as HTMLElement).closest("form");
            if (form) submit({ preventDefault: () => {}, currentTarget: form } as never, false);
          }}>
          Save as draft
        </Button>
      </div>
      </form>
    </div>
  );
}
