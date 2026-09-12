"use client";

import * as React from "react";
import { EMPTY_SIGNALS, type ProctorSignals } from "@/lib/integrity";

/**
 * Watches how an answer is being written.
 *
 * ---------------------------------------------------------------------------
 * Read this before changing anything here
 * ---------------------------------------------------------------------------
 * A web page CANNOT prevent the user leaving it. There is no API to refuse a
 * tab switch, block Cmd-Tab, stop a second window opening, or see what is in
 * any other tab — browsers removed or never shipped all of those on purpose,
 * because a page that could do them would be malware. Anything marketed as a
 * "lockdown browser" that runs in a normal tab is doing exactly what this does.
 *
 * So the goal is not prevention, it is making leaving expensive and visible:
 *
 *   * The moment focus is lost, `away` goes true and the case text and the
 *     editor are blanked behind an overlay. Whatever they switched to, they
 *     cannot read the case while doing it, and they must acknowledge the
 *     interruption to get back in.
 *   * Every departure is counted and reported with the submission.
 *   * In exam mode paste is refused outright, so an answer from elsewhere has
 *     to be retyped by hand.
 *
 * A student determined to cheat can still open devtools and post whatever
 * signals they like. That is a real hole and it is not closable from the
 * client; it is why src/lib/integrity.ts treats these numbers as corroboration
 * rather than proof, and why the server stamps its own clock.
 */

export interface ProctorState {
  signals: ProctorSignals;
  /** Focus is currently elsewhere; the UI should be blanked. */
  away: boolean;
  /** Cleared by the student to resume after an interruption. */
  needsAcknowledgement: boolean;
  examMode: boolean;
}

export interface ProctorApi extends ProctorState {
  /** Attach to each answer field. */
  handlers: {
    onKeyDown: (e: React.KeyboardEvent) => void;
    onPaste: (e: React.ClipboardEvent) => void;
  };
  enterExamMode: () => Promise<void>;
  exitExamMode: () => Promise<void>;
  acknowledge: () => void;
  /** Freeze collection once the answer is submitted. */
  stop: () => void;
}

/** Focus losses shorter than this are a click on the URL bar, not an excursion. */
const AWAY_GRACE_MS = 400;

export function useProctor(enabled: boolean): ProctorApi {
  const [signals, setSignals] = React.useState<ProctorSignals>(EMPTY_SIGNALS);
  const [away, setAway] = React.useState(false);
  const [needsAcknowledgement, setNeedsAcknowledgement] = React.useState(false);
  const [examMode, setExamMode] = React.useState(false);

  const leftAt = React.useRef<number | null>(null);
  const stopped = React.useRef(false);
  // Mirrors examMode for the event listeners, which close over their first
  // render otherwise and would stop counting fullscreen exits after the first.
  const examRef = React.useRef(false);

  const bump = React.useCallback(
    (patch: (s: ProctorSignals) => Partial<ProctorSignals>) => {
      if (stopped.current) return;
      setSignals((s) => ({ ...s, ...patch(s) }));
    },
    [],
  );

  // ---- focus ---------------------------------------------------------------
  React.useEffect(() => {
    if (!enabled) return;

    function leave() {
      if (stopped.current || leftAt.current !== null) return;
      leftAt.current = Date.now();
      setAway(true);
    }

    function back() {
      if (leftAt.current === null) return;
      const ms = Date.now() - leftAt.current;
      leftAt.current = null;
      setAway(false);

      // Tabbing through the page's own controls fires blur/focus pairs in
      // milliseconds. Counting those would flag every keyboard user.
      if (ms < AWAY_GRACE_MS) return;

      bump((s) => ({ blurCount: s.blurCount + 1, blurMs: s.blurMs + ms }));
      setNeedsAcknowledgement(true);
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") leave();
      else back();
    }

    function onFullscreenChange() {
      if (!examRef.current) return;
      if (!document.fullscreenElement) {
        bump((s) => ({ fullscreenExits: s.fullscreenExits + 1 }));
        setExamMode(false);
        examRef.current = false;
        setNeedsAcknowledgement(true);
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", back);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", back);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [enabled, bump]);

  // ---- warn on leaving mid-answer -----------------------------------------
  // The browser shows its own generic dialog and ignores any message we set,
  // but the friction is the point: closing the tab to escape a flagged attempt
  // costs a confirmation.
  React.useEffect(() => {
    if (!enabled || !examMode) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (stopped.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enabled, examMode]);

  const handlers = React.useMemo(
    () => ({
      onKeyDown(e: React.KeyboardEvent) {
        if (!enabled || stopped.current) return;
        // Printable keys plus the edits people actually make. Modifier presses
        // and arrow keys are not writing.
        const k = e.key;
        const counts =
          k.length === 1 || k === "Backspace" || k === "Delete" || k === "Enter";
        if (counts && !e.ctrlKey && !e.metaKey) {
          bump((s) => ({ keystrokes: s.keystrokes + 1 }));
        }
      },

      onPaste(e: React.ClipboardEvent) {
        if (!enabled || stopped.current) return;
        const text = e.clipboardData.getData("text");
        const len = text.length;

        // Exam mode refuses the paste. Practice mode allows it and records it —
        // the student was told in the editor that pasted text is flagged, which
        // is what makes the later penalty fair.
        if (examRef.current) {
          e.preventDefault();
        }

        bump((s) => ({
          pasteCount: s.pasteCount + 1,
          pastedChars: s.pastedChars + (examRef.current ? 0 : len),
          largestPaste: examRef.current ? s.largestPaste : Math.max(s.largestPaste, len),
        }));
      },
    }),
    [enabled, bump],
  );

  const enterExamMode = React.useCallback(async () => {
    try {
      // Fullscreen is not a lock — Esc always leaves it — but leaving is now a
      // deliberate act that fires `fullscreenchange` and gets recorded.
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Denied, or unsupported (iOS Safari has no Element.requestFullscreen).
      // Exam mode still runs: the counters and the overlay are what matter,
      // and refusing to start would just push the student to a browser with
      // less supervision, not more.
    }
    examRef.current = true;
    setExamMode(true);
    bump(() => ({ proctored: true }));
  }, [bump]);

  const exitExamMode = React.useCallback(async () => {
    examRef.current = false;
    setExamMode(false);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Nothing to do; the flag is already down.
      }
    }
  }, []);

  const acknowledge = React.useCallback(() => setNeedsAcknowledgement(false), []);

  const stop = React.useCallback(() => {
    stopped.current = true;
    examRef.current = false;
    setExamMode(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  return {
    signals,
    away,
    needsAcknowledgement,
    examMode,
    handlers,
    enterExamMode,
    exitExamMode,
    acknowledge,
    stop,
  };
}
