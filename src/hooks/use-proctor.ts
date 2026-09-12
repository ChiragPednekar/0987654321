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
 * Exam mode is MANDATORY for every graded attempt, not an option a student
 * chooses. That forces one piece of structure: `requestFullscreen()` only
 * succeeds inside a user gesture, so it cannot be fired from an effect on
 * mount. An auto-start would leave fullscreen silently rejected on every
 * attempt and the product merely looking proctored. Hence `start()`, called
 * from a button the student presses before the editor unlocks.
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
  /** The attempt has begun. Until then the editor stays locked. */
  examMode: boolean;
  /** True while re-entering fullscreen is being attempted. */
  starting: boolean;
  /**
   * Fullscreen is genuinely engaged. False on iOS Safari, which has no
   * Element.requestFullscreen at all, and wherever the browser refuses — the
   * attempt still proceeds under every other control, because refusing to let
   * a student sit the case would push them to a device with no supervision
   * rather than more.
   */
  fullscreen: boolean;
}

export interface ProctorApi extends ProctorState {
  /** Attach to each answer field. */
  handlers: {
    onKeyDown: (e: React.KeyboardEvent) => void;
    onPaste: (e: React.ClipboardEvent) => void;
  };
  /** Must be called from a user gesture, or fullscreen will be refused. */
  start: () => Promise<void>;
  /** Acknowledge an interruption and re-enter fullscreen. Also a user gesture. */
  acknowledge: () => Promise<void>;
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
  const [starting, setStarting] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);

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
      const on = Boolean(document.fullscreenElement);
      setFullscreen(on);
      if (!examRef.current || on) return;

      /**
       * Esc always leaves fullscreen and no page can prevent it. What it must
       * NOT do any more is end the attempt's supervision: exam mode stays on,
       * the exit is counted, and the overlay demands a deliberate re-entry.
       * Turning exam mode off here — which is what this did while it was
       * opt-in — would have handed every student a one-keystroke way out of a
       * mode they are no longer allowed to decline.
       */
      bump((s) => ({ fullscreenExits: s.fullscreenExits + 1 }));
      setNeedsAcknowledgement(true);
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

  /**
   * Best-effort fullscreen. Never throws, and never blocks the attempt.
   *
   * iOS Safari has no Element.requestFullscreen, and any browser may refuse
   * outside a user gesture. Both are survivable: paste blocking, the overlay,
   * the counters and the server clock are all independent of it. Refusing to
   * let someone sit the case because their browser will not go fullscreen
   * would send them to a device with no supervision at all.
   */
  const requestFullscreen = React.useCallback(async () => {
    try {
      const el = document.documentElement;
      if (!el.requestFullscreen) return false;
      /**
       * Raced against a timeout because the promise does not always settle.
       * Where fullscreen is disallowed — an embedded frame without
       * `allow="fullscreen"`, a managed browser policy — some engines neither
       * resolve nor reject it, they simply leave it pending. Awaiting it bare
       * left the Start button spinning and the student with no way to answer
       * the case at all, which is a far worse failure than not being
       * fullscreen.
       */
      await Promise.race([
        el.requestFullscreen(),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
      return Boolean(document.fullscreenElement);
    } catch {
      return false;
    }
  }, []);

  /**
   * Begins the supervised attempt. Must be called from a user gesture.
   *
   * There is no counterpart. Exam mode is mandatory for every graded answer,
   * so once it is on the only way out is submitting or leaving the page, and
   * both of those are recorded.
   */
  const start = React.useCallback(async () => {
    if (stopped.current || examRef.current) return;

    // Exam mode is armed BEFORE fullscreen is attempted, never after. Paste
    // blocking, the overlay, the counters and the server clock are what
    // actually supervise the attempt; fullscreen is the one part that may
    // legitimately be unavailable, and it must not be able to gate the rest.
    examRef.current = true;
    setExamMode(true);
    bump(() => ({ proctored: true }));

    setStarting(true);
    setFullscreen(await requestFullscreen());
    setStarting(false);
  }, [bump, requestFullscreen]);

  /**
   * Dismisses the interruption overlay and goes back into fullscreen.
   *
   * Also a user gesture — the Resume button — which is exactly why the exit is
   * routed through an overlay the student has to click rather than being
   * repaired silently: nothing else would give the browser the activation it
   * needs to re-enter.
   */
  const acknowledge = React.useCallback(async () => {
    setNeedsAcknowledgement(false);
    if (stopped.current || document.fullscreenElement) return;
    setFullscreen(await requestFullscreen());
  }, [requestFullscreen]);

  const stop = React.useCallback(() => {
    stopped.current = true;
    examRef.current = false;
    setExamMode(false);
    setFullscreen(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  return {
    signals,
    away,
    needsAcknowledgement,
    examMode,
    starting,
    fullscreen,
    handlers,
    start,
    acknowledge,
    stop,
  };
}
