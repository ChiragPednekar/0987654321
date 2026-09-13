"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Play, Send, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MAX_ANSWER_CHARS, MIN_ANSWER_CHARS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useProctor } from "@/hooks/use-proctor";
import { ProctorGate, ProctorOverlay } from "@/components/case/proctor-overlay";

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

  /**
   * Contests are the one surface where the answer is ranked against other
   * people, and they were the one surface with no supervision at all: this
   * component has its own textarea and posts to /api/submissions directly,
   * so none of the proctoring wired into the case editor reached it.
   */
  const proctor = useProctor(true);

  // The same server-side clock the case editor stamps. Without it every
  // contest entry reached the integrity check with an unknown elapsed time and
  // silently skipped the speed test.
  React.useEffect(() => {
    void fetch("/api/attempts/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ case_id: caseId }),
    }).catch(() => {
      // Best effort, as in the case editor: a missing stamp skips the speed
      // check, which is the lenient outcome and the right one.
    });
  }, [caseId]);

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

    /**
     * Before the await, deliberately.
     *
     * requestFullscreen() is only granted during transient user activation,
     * which this click carries and an awaited network round trip can outlive.
     * Entering exam mode after the fetch resolved would have fullscreen
     * refused on a slow connection and nowhere else — the worst kind of bug,
     * since it would work every time it was tested locally.
     */
    void proctor.start();

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
          signals: proctor.signals,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? "Submission failed.");
        return;
      }

      window.localStorage.removeItem(storageKey);
      proctor.stop();
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
            <p className="mt-3 text-sm text-muted-foreground">
              This entry is answered under exam conditions: the page goes
              fullscreen, pasting is disabled, and leaving the page is recorded
              with your answer.
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

  /**
   * The timer is running but exam mode is not — this tab reloaded, or the entry
   * was begun on another device. Unlike the case editor, whose gate is the only
   * way to reach a textarea at all, this component's textarea is unlocked by
   * `startedAt`, which comes from the server and survives a refresh. Without
   * this the answer box would come back live with supervision silently off:
   * paste allowed, departures uncounted.
   *
   * The clock keeps running behind the gate. That is the honest trade — the
   * contest timer is server-stamped and cannot be paused for a reload, and one
   * click is a small price against an unsupervised entry on a ranked board.
   */
  if (!proctor.examMode) {
    return <ProctorGate resumed starting={proctor.starting} onStart={proctor.start} />;
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const tooShort = answer.trim().length < MIN_ANSWER_CHARS;

  return (
    <div className="space-y-3">
      {proctor.examMode && proctor.needsAcknowledgement && (
        <ProctorOverlay
          count={proctor.signals.blurCount}
          onResume={proctor.acknowledge}
        />
      )}

      <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          Exam conditions. Pasting is disabled — type your answer here. Time
          away from this page is recorded and can reduce your mark.
        </p>
      </div>

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
        onKeyDown={proctor.handlers.onKeyDown}
        onPaste={proctor.handlers.onPaste}
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
