"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OBJECTIVE_TRACKS } from "@/lib/objective";

const SELECT = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

/**
 * Write one multiple-choice aptitude question.
 *
 * It joins the teacher's own bank, visible to them on the track's page in the
 * Aptitude library, where it can be ticked into a quiz for a batch like any
 * platform question. It never appears in other students' practice.
 */
export function AptitudeQuestionForm() {
  const [busy, setBusy] = React.useState(false);
  const [options, setOptions] = React.useState(["", "", "", ""]);
  const [correct, setCorrect] = React.useState(0);
  const [savedTrack, setSavedTrack] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const filled = options.map((o) => o.trim());
    if (filled.some((o) => !o)) {
      toast.error("Fill in every option, or remove the empty ones.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/teacher/aptitude-questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          track: String(f.get("track") ?? ""),
          topic: String(f.get("topic") ?? ""),
          difficulty: String(f.get("difficulty") ?? "medium"),
          context: String(f.get("context") ?? "").trim() || null,
          stem: String(f.get("stem") ?? ""),
          options: filled,
          correct_index: correct,
          explanation: String(f.get("explanation") ?? ""),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(body.error ?? "Could not save the question.");
        return;
      }
      toast.success("Question added to your bank.");
      setSavedTrack(String(f.get("track") ?? ""));
      // Ready for the next one: keep the track, topic and difficulty, clear the rest.
      const form = formRef.current;
      if (form) {
        (form.elements.namedItem("stem") as HTMLTextAreaElement).value = "";
        (form.elements.namedItem("context") as HTMLTextAreaElement).value = "";
        (form.elements.namedItem("explanation") as HTMLTextAreaElement).value = "";
      }
      setOptions(["", "", "", ""]);
      setCorrect(0);
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6">
      {savedTrack ? (
        <p className="rounded-md border border-[var(--success)]/40 bg-[var(--success)]/5 px-3 py-2 text-sm">
          Saved. Find it — marked &ldquo;Yours&rdquo; — on the{" "}
          <Link href={`/practice/${savedTrack}`} className="underline underline-offset-4">
            track page
          </Link>
          , where you can tick it into a quiz for a batch. Or write another below.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="track">Track</Label>
          <select id="track" name="track" required className={SELECT}>
            {OBJECTIVE_TRACKS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="difficulty">Difficulty</Label>
          <select id="difficulty" name="difficulty" defaultValue="medium" className={SELECT}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div>
          <Label htmlFor="topic">Topic</Label>
          <Input id="topic" name="topic" required minLength={2} maxLength={60} placeholder="Percentages" />
        </div>
      </div>

      <div>
        <Label htmlFor="context">Data or passage (optional)</Label>
        <Textarea
          id="context"
          name="context"
          rows={3}
          maxLength={2000}
          placeholder="A table, a passage or a set of figures the question refers to."
        />
      </div>

      <div>
        <Label htmlFor="stem">Question</Label>
        <Textarea id="stem" name="stem" required rows={3} minLength={5} maxLength={2000} />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Options — select the correct one</legend>
        <ul className="mt-2 space-y-2">
          {options.map((value, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                aria-label={`Option ${String.fromCharCode(65 + i)} is correct`}
                checked={correct === i}
                onChange={() => setCorrect(i)}
                className="size-4"
              />
              <span className="w-4 text-sm text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
              <Input
                value={value}
                maxLength={500}
                onChange={(e) => setOptions((o) => o.map((v, j) => (j === i ? e.target.value : v)))}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
              />
              {options.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove option ${String.fromCharCode(65 + i)}`}
                  onClick={() => {
                    setOptions((o) => o.filter((_, j) => j !== i));
                    setCorrect((c) => (c === i ? 0 : c > i ? c - 1 : c));
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {options.length < 6 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setOptions((o) => [...o, ""])}
          >
            <Plus className="size-4" /> Add option
          </Button>
        )}
      </fieldset>

      <div>
        <Label htmlFor="explanation">Explanation</Label>
        <Textarea
          id="explanation"
          name="explanation"
          required
          rows={3}
          minLength={5}
          maxLength={3000}
          placeholder="The working, shown to students after they submit."
        />
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        Save question
      </Button>
    </form>
  );
}
