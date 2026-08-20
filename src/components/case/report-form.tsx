"use client";

import * as React from "react";
import { CheckCircle2, Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CaseReportType } from "@/lib/types/database";

const TYPES: { value: CaseReportType; label: string; hint: string }[] = [
  {
    value: "wrong_rubric",
    label: "Wrong rubric",
    hint: "The criteria or weights do not fit this case",
  },
  {
    value: "ambiguous_prompt",
    label: "Ambiguous prompt",
    hint: "The question can be read more than one way",
  },
  {
    value: "data_error",
    label: "Data error",
    hint: "Numbers in the exhibits do not add up",
  },
  { value: "other", label: "Other", hint: "Anything else" },
];

const MAX = 1000;

export function ReportForm({
  caseId,
  signedIn,
}: {
  caseId: string;
  signedIn: boolean;
}) {
  const [type, setType] = React.useState<CaseReportType>("ambiguous_prompt");
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const tooShort = description.trim().length < 10;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (tooShort) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/case-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ case_id: caseId, type, description }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not submit report.");
        return;
      }

      setSent(true);
      setDescription("");
    } catch {
      toast.error("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!signedIn) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Log in to report a problem with this case.
      </p>
    );
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CheckCircle2 className="size-8 text-[var(--success)]" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Report submitted</p>
          <p className="text-sm text-muted-foreground">
            Thanks — this is how bad cases get found. We review these directly.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSent(false)}>
          Report something else
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What is wrong?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {TYPES.map((option) => (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-lg border p-3 transition-colors",
                type === option.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/40",
              )}
            >
              <input
                type="radio"
                name="report-type"
                value={option.value}
                checked={type === option.value}
                onChange={() => setType(option.value)}
                className="sr-only"
              />
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">
                {option.hint}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="report-description" className="text-sm font-medium">
            Details
          </label>
          <span
            className={cn(
              "text-xs tabular",
              description.length > MAX
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {description.length}/{MAX}
          </span>
        </div>
        <Textarea
          id="report-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={MAX}
          placeholder="Be specific — which exhibit, which number, or which part of the prompt."
          className="min-h-[130px] resize-y"
        />
      </div>

      <Button type="submit" disabled={submitting || tooShort}>
        {submitting ? <Loader2 className="animate-spin" /> : <Flag />}
        Submit report
      </Button>
    </form>
  );
}
