"use client";

import { Eye, Loader2, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What a student sees when they leave the page mid-answer in exam mode.
 *
 * Fixed to the viewport rather than scoped to the editor, deliberately: the
 * thing worth hiding is the case text, not the empty textarea. The page cannot
 * stop them switching to another tab — no web page can — so the deterrent is
 * that the case is not readable while they are there, and coming back costs an
 * acknowledgement that has already been counted.
 *
 * Rendered only after focus returns. While the tab is genuinely hidden nothing
 * is painted anyway, and the browser throttles the timers that would paint it.
 */
export function ProctorOverlay({
  count,
  onResume,
}: {
  count: number;
  onResume: () => void | Promise<void>;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="proctor-title"
    >
      <div className="max-w-md space-y-4 rounded-xl border bg-card p-6 text-center shadow-lg">
        <ShieldAlert className="mx-auto size-8 text-[var(--warning,#d97706)]" />
        <h2 id="proctor-title" className="text-lg font-semibold">
          You left the exam window
        </h2>
        <p className="text-sm text-muted-foreground">
          This attempt is proctored. Leaving the page has been recorded and will
          be shown with your submission.
        </p>
        <p className="text-sm font-medium tabular">
          {count === 1 ? "1 interruption" : `${count} interruptions`} so far
        </p>
        {/*
          The click matters for more than dismissing this card: re-entering
          fullscreen needs a user gesture, and this button is the gesture. That
          is why an interruption is repaired through an overlay the student has
          to press rather than silently in the background.
        */}
        <Button onClick={() => void onResume()} className="w-full">
          <Eye />
          Resume
        </Button>
      </div>
    </div>
  );
}

export const CASE_RULES = [
  "The page goes fullscreen while you write.",
  "Pasting is disabled. Type your answer here.",
  "Leaving the page hides the case and is recorded with your answer.",
  "Answers that were not written here can lose marks.",
];

/**
 * The rules differ by surface, and saying the wrong ones is worse than saying
 * none. Telling a student "pasting is disabled, type your answer here" above
 * a multiple-choice paper reads as boilerplate nobody checked, and the moment
 * one rule is visibly untrue the rest stop being believed. So each surface
 * states what is actually enforced on it.
 */
export const QUIZ_RULES = [
  "The page goes fullscreen while you answer.",
  "Leaving the page is recorded with every answer.",
  "Looking a question up in another tab is the thing this counts.",
];

export const WORKBENCH_RULES = [
  "The page goes fullscreen while you work.",
  "Pasting is disabled. Type the query or formula yourself.",
  "Leaving the page is recorded with your attempt.",
];

export const CONVERSATION_RULES = [
  "The page goes fullscreen for the whole session.",
  "Pasting is disabled. Answer in your own words.",
  "Leaving the page is recorded and shown with your result.",
];

/**
 * The gate every graded attempt starts behind.
 *
 * Exam mode is mandatory, and `requestFullscreen()` is only granted inside a
 * user gesture — so there has to be something to press. Starting it from an
 * effect on mount would have fullscreen refused every single time and leave
 * the product looking supervised without being it.
 */
export function ProctorGate({
  starting,
  onStart,
  /**
   * The attempt was already under way and the page was reloaded. Exam mode
   * cannot survive a reload — nothing in the browser may re-enter fullscreen
   * without a fresh gesture — so the gate reappears rather than letting the
   * student carry on unsupervised.
   */
  resumed = false,
  title,
  rules = CASE_RULES,
}: {
  starting: boolean;
  onStart: () => void | Promise<void>;
  resumed?: boolean;
  title?: string;
  rules?: readonly string[];
}) {
  return (
    <div className="rounded-xl border bg-card p-6 text-center">
      <Lock className="mx-auto size-7 text-muted-foreground" />
      <h3 className="mt-3 font-medium">
        {resumed
          ? "Re-enter exam mode to carry on"
          : (title ?? "This case is answered under exam conditions")}
      </h3>
      <ul className="mx-auto mt-3 max-w-sm space-y-1.5 text-left text-xs text-muted-foreground">
        {rules.map((rule) => (
          <li key={rule}>· {rule}</li>
        ))}
      </ul>
      <Button className="mt-5" onClick={() => void onStart()} disabled={starting}>
        {starting ? <Loader2 className="animate-spin" /> : <Lock />}
        {starting ? "Starting…" : resumed ? "Resume" : "Start"}
      </Button>
    </div>
  );
}
