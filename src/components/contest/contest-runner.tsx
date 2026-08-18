"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Send, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MAX_ANSWER_CHARS, MIN_ANSWER_CHARS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ContestRunnerProps {
  contestId: string;
  caseId: string;
  durationMinutes: number;
  maxSpeedBonus: number;
  /** ISO timestamp if the user already claimed their timer. */
  startedAt: string | null;
  alreadySubmitted: boolean;
  isOpen: boolean;
}

export function ContestRunner({
  contestId,
  caseId,
  durationMinutes,
  maxSpeedBonus,
  startedAt: initialStartedAt,
  alreadySubmitted,
  isOpen,
}: ContestRunnerProps) {
  const router = useRouter();
  const [startedAt, setStartedAt] = React.useState(initialStartedAt);
  const [answer, setAnswer] = React.useState("");
  const [starting, setStarting] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());

  const storageKey = `casecode:contest:${contestId}`;

  React.useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setAnswer(saved);
  }, [storageKey]);

  React.useEffect(() => {
    if (!answer) return;
    const timer = setTimeout(
      () => window.localStorage.setItem(storageKey, answer),
      500,
    );
    return () => clearTimeout(timer);
  }, [answer, storageKey]);

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsedSeconds = startedAt
    ? Math.floor((now - new Date(startedAt).getTime()) / 1000)
    : 0;
  const remainingSeconds = Math.max(0, durationMinutes * 60 - elapsedSeconds);
  const expired = startedAt !== null && remainingSeconds === 0;

  const projectedBonus = Math.max(
    0,
    Math.round(
      maxSpeedBonus * (1 - Math.min(1, elapsedSeconds / (durationMinutes * 60))),
    ),
  );

  async function start() {
    setStarting(true);
    const response = await fetch(`/api/contests/${contestId}/start`, {
      method: "POST",
    });
    const payload = await response.json();
    setStarting(false);

    if (!response.ok) {
      toast.error(payload.error ?? "Could not start.");
      return;
    }

    setStartedAt(payload.started_at);
    toast.success("Timer started. Good luck.");
  }

  async function submit() {
    setSubmitting(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          contest_id: contestId,
          answer,
          time_spent_seconds: elapsedSeconds,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? "Submission failed.");
        return;
      }

      window.localStorage.removeItem(storageKey);
      toast.success("Submitted. Final ranks are published when the contest closes.");
      router.refresh();
    } catch {
      toast.error("Network error. Your draft is saved locally.");
    } finally {
      setSubmitting(false);
    }
  }

  if (alreadySubmitted) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm font-medium">Your entry is in.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Rankings are published once the contest closes.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isOpen) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            This contest is not currently accepting entries.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!startedAt) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <Timer className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">
              You get {durationMinutes} minutes once you start
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The timer starts the moment you click, and keeps running if you
              close the tab. Finishing early earns up to {maxSpeedBonus} bonus
              points.
            </p>
          </div>
          <Button onClick={start} disabled={starting}>
            {starting ? <Loader2 className="animate-spin" /> : <Play />}
            Start my timer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const tooShort = answer.trim().length < MIN_ANSWER_CHARS;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2.5">
        <span
          className={cn(
            "flex items-center gap-2 font-mono text-lg font-semibold tabular",
            remainingSeconds < 300 && "text-destructive",
          )}
        >
          <Timer className="size-4" />
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
        <span className="text-xs text-muted-foreground tabular">
          Speed bonus if you submit now: +{projectedBonus}
        </span>
      </div>

      {expired && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Your time is up. You can still submit, but the speed bonus is zero.
        </div>
      )}

      <Textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Structure, analysis, risks, recommendation…"
        className="min-h-[420px] resize-y font-mono text-[13px] leading-relaxed"
        maxLength={MAX_ANSWER_CHARS}
      />

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground tabular">
          {answer.trim() ? answer.trim().split(/\s+/).length : 0} words
        </p>
        <Button onClick={submit} disabled={submitting || tooShort}>
          {submitting ? <Loader2 className="animate-spin" /> : <Send />}
          Submit entry
        </Button>
      </div>
    </div>
  );
}
