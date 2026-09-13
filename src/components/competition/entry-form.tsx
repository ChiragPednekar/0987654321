"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_ANSWER_CHARS, MIN_ANSWER_CHARS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * The team's entry.
 *
 * Deliberately a plain textarea with no proctoring: a competition is a
 * take-home team effort, and pasting in the section your teammate wrote is the
 * process working, not a violation. The individual-submission integrity checks
 * would flag every organised team.
 */
export function EntryForm({
  slug,
  existing,
  submittedAt,
  submittedByName,
}: {
  slug: string;
  existing: string;
  submittedAt: string | null;
  submittedByName: string | null;
}) {
  const router = useRouter();
  const [answer, setAnswer] = React.useState(existing);
  const [busy, setBusy] = React.useState(false);

  const tooShort = answer.trim().length < MIN_ANSWER_CHARS;
  const tooLong = answer.length > MAX_ANSWER_CHARS;

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch(`/api/competitions/${slug}/entry`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not submit.");
        return;
      }
      toast.success("Entry submitted. Results are published after the deadline.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {submittedAt && (
        <p className="text-xs text-muted-foreground">
          Last submitted {new Date(submittedAt).toLocaleString()}
          {submittedByName ? ` by ${submittedByName}` : ""}. Submitting again
          replaces it.
        </p>
      )}
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Your team's submission. Paste it together here — one document, one entry."
        className="min-h-[420px] resize-y font-mono text-[13px] leading-relaxed"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground tabular">
          <span className={cn(tooLong && "text-destructive")}>
            {answer.length.toLocaleString()}/{MAX_ANSWER_CHARS.toLocaleString()}
          </span>
          {tooShort && ` · at least ${MIN_ANSWER_CHARS} characters`}
        </p>
        <Button onClick={submit} disabled={busy || tooShort || tooLong}>
          {busy ? <Loader2 className="animate-spin" /> : <Send />}
          {submittedAt ? "Replace entry" : "Submit entry"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        You will not see your score until results are published — otherwise
        teams would resubmit against their own mark until they had
        reverse-engineered the rubric.
      </p>
    </div>
  );
}
