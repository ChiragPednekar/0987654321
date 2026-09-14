"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_ANSWER_CHARS, MIN_ANSWER_CHARS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useProctor } from "@/hooks/use-proctor";
import { ProctorGate, ProctorOverlay } from "@/components/case/proctor-overlay";

/**
 * The team's entry.
 *
 * This was deliberately unproctored, on the reasoning that a competition is a
 * take-home team effort and pasting in a teammate's section is the process
 * working. That reasoning was overruled, and on reflection the counter-argument
 * is the stronger one: if pasting is allowed on the one ranked surface, an
 * entry written entirely by a chat window arrives with no behavioural evidence
 * at all, and the only thing left is the grader's read of the prose — which
 * this codebase has measured as too unstable to dock marks on its own. Allowing
 * paste here would mean no enforcement exactly where the stakes are highest.
 *
 * So exam mode applies, with one deliberate difference from every other
 * surface: the BRIEF is not gated. A take-home runs for days and is meant to be
 * read, discussed and worked on away from this page. Only the composition of
 * the entry is supervised, which is why there is no server clock here either —
 * "how long did this take" is not a meaningful question about a week-long
 * competition.
 *
 * The cost is real and worth stating: a team can no longer paste its assembled
 * document in. They draft wherever they like and type the final version here.
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

  const proctor = useProctor(true);

  const tooShort = answer.trim().length < MIN_ANSWER_CHARS;
  const tooLong = answer.length > MAX_ANSWER_CHARS;

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch(`/api/competitions/${slug}/entry`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer, signals: proctor.signals }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not submit.");
        return;
      }
      if (payload.integrity_warning) toast.warning(payload.integrity_warning);
      toast.success("Entry submitted. Results are published after the deadline.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (!proctor.examMode) {
    return (
      <ProctorGate
        starting={proctor.starting}
        onStart={proctor.start}
        title="The entry is written under exam conditions"
        rules={[
          "Read the brief and work on it wherever you like — that part is not supervised.",
          "The page goes fullscreen while the entry is written.",
          "Pasting is disabled here, so the final version is typed in.",
          "Leaving the page is recorded and shown with the entry.",
        ]}
      />
    );
  }

  return (
    <div className="space-y-3">
      {proctor.needsAcknowledgement && (
        <ProctorOverlay
          count={proctor.signals.blurCount}
          onResume={proctor.acknowledge}
        />
      )}
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
        onKeyDown={proctor.handlers.onKeyDown}
        onPaste={proctor.handlers.onPaste}
        placeholder="Your team's submission — one document, one entry. Type it here; pasting is disabled."
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
        Exam conditions. Pasting is disabled — type the entry in. Time away
        from this page is recorded with it.
      </p>
      <p className="text-xs text-muted-foreground">
        You will not see your score until results are published — otherwise
        teams would resubmit against their own mark until they had
        reverse-engineered the rubric.
      </p>
    </div>
  );
}
