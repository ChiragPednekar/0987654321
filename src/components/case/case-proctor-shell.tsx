"use client";

import * as React from "react";
import { Lock, Timer } from "lucide-react";
import { toast } from "sonner";
import { useProctor, type ProctorApi } from "@/hooks/use-proctor";
import { ProctorGate, ProctorOverlay } from "@/components/case/proctor-overlay";
import { CameraPreview } from "@/components/proctor/camera-preview";
import { Tabs } from "@/components/ui/tabs";
import { formatDuration } from "@/lib/utils";

export interface CaseQuestionData {
  scenario: string;
  instructions: string;
  supporting_data?: unknown;
  attachments?: unknown[];
  expected_framework?: string | null;
}

interface CaseProctorContextValue {
  proctor: ProctorApi;
  startedAt: number;
  elapsed: number;
  finishAttempt: () => void;
  question: CaseQuestionData | null;
  hasSubmitted: boolean;
}

const CaseProctorContext = React.createContext<CaseProctorContextValue | null>(
  null,
);

export function useCaseProctor(): CaseProctorContextValue | null {
  return React.useContext(CaseProctorContext);
}

interface CaseProctorShellProps {
  caseId: string;
  slug: string;
  signedIn: boolean;
  entitled: boolean;
  defaultTab: string;
  hasSubmissionParam: boolean;
  hasSubmitted: boolean;
  initialQuestion?: CaseQuestionData | null;
  children: React.ReactNode;
}

/**
 * Page-level proctoring shell for `/cases/[slug]`.
 *
 * Starts proctoring (camera detection, fullscreen, and tab/window switch
 * blocking) as soon as the student opens the question page — covering the
 * Problem tab as well as My Solution, Hints, and every other tab so switching
 * between reading the scenario and writing the answer never drops supervision.
 *
 * Secures case questions: scenario and instructions are fetched from /api/cases/open
 * ONLY after Start is clicked. Top Solutions and Discussion are locked until
 * the student has submitted.
 */
export function CaseProctorShell({
  slug,
  signedIn,
  entitled,
  defaultTab,
  hasSubmissionParam,
  hasSubmitted,
  initialQuestion,
  children,
}: CaseProctorShellProps) {
  const enabled = signedIn && entitled;
  const proctor = useProctor(enabled);

  const [question, setQuestion] = React.useState<CaseQuestionData | null>(
    initialQuestion ?? null,
  );
  const [opening, setOpening] = React.useState(false);

  const [tab, setTab] = React.useState(defaultTab);
  const [prevDefaultTab, setPrevDefaultTab] = React.useState(defaultTab);
  const [completed, setCompleted] = React.useState(hasSubmissionParam || hasSubmitted);
  const [prevHasSubmission, setPrevHasSubmission] = React.useState(hasSubmissionParam);
  const [startedAt, setStartedAt] = React.useState(() => Date.now());
  const [elapsed, setElapsed] = React.useState(0);

  // Sync tab when navigating to `?submission=...#review` after submitting.
  if (prevDefaultTab !== defaultTab) {
    setPrevDefaultTab(defaultTab);
    setTab(defaultTab);
  }
  if (prevHasSubmission !== hasSubmissionParam) {
    setPrevHasSubmission(hasSubmissionParam);
    if (hasSubmissionParam) setCompleted(true);
  }

  const handleStart = React.useCallback(async () => {
    setCompleted(false);
    setStartedAt(Date.now());
    setElapsed(0);
    setOpening(true);

    // Arm proctoring before network await to preserve user gesture for fullscreen
    void proctor.start();

    try {
      const res = await fetch("/api/cases/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not open the case.");
        proctor.stop();
        return;
      }
      setQuestion(data);
    } catch {
      toast.error("Network error opening case.");
      proctor.stop();
    } finally {
      setOpening(false);
    }
  }, [proctor, slug]);

  React.useEffect(() => {
    if (!proctor.examMode) return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [proctor.examMode, startedAt]);

  // Anti-tampering client listeners: prevent copying questions and right-click during exam
  React.useEffect(() => {
    if (!proctor.examMode) return;
    const preventCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName !== "TEXTAREA" && target?.tagName !== "INPUT") {
        e.preventDefault();
        toast.warning("Copying case content is disabled during exam conditions.");
      }
    };
    const preventContext = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener("copy", preventCopy);
    window.addEventListener("contextmenu", preventContext);
    return () => {
      window.removeEventListener("copy", preventCopy);
      window.removeEventListener("contextmenu", preventContext);
    };
  }, [proctor.examMode]);

  const finishAttempt = React.useCallback(() => {
    setCompleted(true);
    proctor.stop();
  }, [proctor]);

  const contextValue = React.useMemo<CaseProctorContextValue>(
    () => ({ proctor, startedAt, elapsed, finishAttempt, question, hasSubmitted }),
    [proctor, startedAt, elapsed, finishAttempt, question, hasSubmitted],
  );

  function handleTabChange(nextTab: string) {
    if ((proctor.examMode || (!completed && !hasSubmitted)) && (nextTab === "top" || nextTab === "discussion")) {
      toast.error("Top solutions and discussion are locked until you have submitted your solution.");
      return;
    }
    setTab(nextTab);
    // Leaving the post-submission review tab to read the problem or write a new
    // solution requires re-entering exam mode.
    if (!proctor.examMode && nextTab !== "review") {
      setCompleted(false);
    }
  }

  const reviewing = (completed || hasSubmitted) && (tab === "review" || tab === "solution");

  if (enabled && !proctor.examMode && !reviewing) {
    return (
      <ProctorGate
        camera={proctor.camera}
        starting={proctor.starting || opening}
        onStart={handleStart}
      />
    );
  }

  return (
    <CaseProctorContext.Provider value={contextValue}>
      {proctor.examMode && <CameraPreview camera={proctor.camera} />}
      {proctor.examMode && proctor.needsAcknowledgement && (
        <ProctorOverlay
          count={proctor.signals.blurCount}
          onResume={proctor.acknowledge}
        />
      )}

      {proctor.examMode && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3.5 py-2.5 text-xs">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              Exam conditions. Pasting and copying are disabled — type your answer here.
              Switching tabs or leaving this window ends the test.
            </p>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1.5 text-[var(--warning,#d97706)]">
              <Lock className="size-3.5" />
              {proctor.fullscreen ? "Exam mode" : "Exam mode (no fullscreen)"}
            </span>
            <span className="flex items-center gap-1.5">
              <Timer className="size-3.5" />
              <span className="tabular">{formatDuration(elapsed)}</span>
            </span>
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={handleTabChange}>
        {children}
      </Tabs>
    </CaseProctorContext.Provider>
  );
}
