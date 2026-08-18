"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Send, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MAX_ANSWER_CHARS, MIN_ANSWER_CHARS } from "@/lib/constants";
import { cn, formatDuration } from "@/lib/utils";

interface AnswerEditorProps {
  caseId: string;
  caseSlug: string;
  contestId?: string;
  signedIn: boolean;
  /** Restores an in-progress draft between reloads. */
  storageKey: string;
}

export function AnswerEditor({
  caseId,
  caseSlug,
  contestId,
  signedIn,
  storageKey,
}: AnswerEditorProps) {
  const router = useRouter();
  const [answer, setAnswer] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const startedAt = React.useRef<number>(Date.now());

  // Restore any local draft on mount.
  React.useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setAnswer(saved);
  }, [storageKey]);

  // Persist the draft — losing 45 minutes of writing to a stray refresh is
  // the fastest way to lose a user.
  React.useEffect(() => {
    if (!answer) return;
    const timer = setTimeout(
      () => window.localStorage.setItem(storageKey, answer),
      500,
    );
    return () => clearTimeout(timer);
  }, [answer, storageKey]);

  React.useEffect(() => {
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const tooShort = answer.trim().length < MIN_ANSWER_CHARS;
  const tooLong = answer.length > MAX_ANSWER_CHARS;

  async function submit() {
    if (tooShort || tooLong) return;
    setSubmitting(true);

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          contest_id: contestId,
          answer,
          time_spent_seconds: Math.floor((Date.now() - startedAt.current) / 1000),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? "Submission failed. Try again.");
        return;
      }

      window.localStorage.removeItem(storageKey);
      toast.success("Evaluated. Scroll down for your score.");
      router.push(`/cases/${caseSlug}?submission=${payload.submission_id}#review`);
      router.refresh();
    } catch {
      toast.error("Network error. Your draft is saved locally.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!signedIn) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Log in to submit an answer and get it graded.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href={`/login?next=/cases/${caseSlug}`}>Log in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Timer className="size-3.5" />
          <span className="tabular">{formatDuration(elapsed)}</span>
        </span>
        <span className="tabular">
          {wordCount} words ·{" "}
          <span className={cn(tooLong && "text-destructive")}>
            {answer.length.toLocaleString()}/{MAX_ANSWER_CHARS.toLocaleString()}
          </span>
        </span>
      </div>

      <Textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder={
          "Structure your answer. A strong response usually has:\n\n" +
          "1. How you're breaking the problem down\n" +
          "2. The analysis, with the numbers actually computed\n" +
          "3. Risks and what would change your mind\n" +
          "4. A clear recommendation you commit to\n\n" +
          "Markdown works here."
        }
        className="min-h-[420px] resize-y font-mono text-[13px] leading-relaxed"
        spellCheck
      />

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {tooShort
            ? `At least ${MIN_ANSWER_CHARS} characters (${answer.trim().length} so far).`
            : "Draft saved locally as you type."}
        </p>
        <Button onClick={submit} disabled={submitting || tooShort || tooLong}>
          {submitting ? <Loader2 className="animate-spin" /> : <Send />}
          {submitting ? "Evaluating…" : "Submit for evaluation"}
        </Button>
      </div>
    </div>
  );
}
