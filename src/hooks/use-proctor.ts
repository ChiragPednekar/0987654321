"use client";

import * as React from "react";
import { EMPTY_SIGNALS, type ProctorSignals } from "@/lib/integrity";
import { useCameraProctor, type CameraApi } from "@/hooks/use-camera-proctor";
import type { EndReason } from "@/lib/camera-proctor";
import { setEndedTest } from "@/hooks/proctor-ended-store";

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
 *   * Switching tabs, or staying in another window for two seconds, ENDS the
 *     test outright (endIfStillAway below). Only a glance shorter than that —
 *     a click on the address bar — gets the overlay instead.
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
  /**
   * The camera ended this test, now or on an earlier visit to this page. While
   * set, the surface shows the ended screen and nothing can be written or
   * started — see ProctorEnded.
   */
  ended: { reason: EndReason; at: string } | null;
}

export interface ProctorApi extends ProctorState {
  /**
   * The webcam. Its counters are already merged into `signals`, so a surface
   * that submits `signals` reports the camera without knowing it exists; this
   * is exposed for the gate's camera step and the corner preview.
   */
  camera: CameraApi;
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
  /** Reset proctoring state and re-arm for another attempt. */
  reset: () => void;
}

/** Focus losses shorter than this are a click on the URL bar, not an excursion. */
const AWAY_GRACE_MS = 400;

/**
 * Time in another window, with this tab still showing, that ends the test.
 *
 * Switching TABS ends it at once — the page is hidden, and there is nothing
 * innocent a student does in an exam by opening another tab. Focus moving to
 * another window while this one stays visible is less certain: a click on the
 * browser's own address bar or a system dialog does it too. So that has to
 * last two seconds, which no real lookup takes less than and no stray click
 * takes more than.
 */
const LEAVE_ENDS_AFTER_MS = 2_000;

/**
 * After fullscreen is entered or left, focus and visibility can flicker while
 * the browser moves the window — on macOS it slides into its own Space. An
 * excursion that starts inside this window is not judged until it is over, so
 * a transition never ends anyone's test; one that is still going once it
 * passes is judged as usual.
 */
const FULLSCREEN_SETTLE_MS = 1_500;

export function useProctor(enabled: boolean): ProctorApi {
  const [signals, setSignals] = React.useState<ProctorSignals>(EMPTY_SIGNALS);
  const [away, setAway] = React.useState(false);
  const [needsAcknowledgement, setNeedsAcknowledgement] = React.useState(false);
  const [examMode, setExamMode] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [ended, setEnded] = React.useState<ProctorState["ended"]>(null);

  // Counts only while the attempt is running; see useCameraProctor.
  const camera = useCameraProctor(enabled, examMode);

  const leftAt = React.useRef<number | null>(null);
  const stopped = React.useRef(false);
  // Mirrors examMode for the event listeners, which close over their first
  // render otherwise and would stop counting fullscreen exits after the first.
  const examRef = React.useRef(false);
  // Read by start(), which must refuse synchronously once the test has ended.
  const endedRef = React.useRef(false);
  // The focus listeners are bound once; this lets them reach the current
  // endTest, which is declared further down.
  const endTestRef = React.useRef<(reason: EndReason) => void>(() => {});
  const leaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleUntil = React.useRef(0);

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

    /**
     * Ends the test if the student is still away once the allowance is up:
     * at once for a hidden tab, after LEAVE_ENDS_AFTER_MS for another window,
     * and never before a fullscreen transition has settled.
     *
     * Judged when the time is up rather than on return, deliberately. A student
     * who switches away and then reloads instead of coming back would never
     * "return", and the ending would never be recorded.
     */
    function endIfStillAway(hidden: boolean) {
      if (!examRef.current || endedRef.current || leaveTimer.current) return;
      const wait = Math.max(
        settleUntil.current - Date.now(),
        hidden ? 0 : LEAVE_ENDS_AFTER_MS,
      );
      const check = () => {
        leaveTimer.current = null;
        if (!examRef.current || endedRef.current) return;
        // hasFocus, not just the blur: focus moving into the page's own
        // iframe or devtools-free widgets blurs the window but keeps the
        // document focused.
        const away =
          document.visibilityState === "hidden" ||
          (leftAt.current !== null && !document.hasFocus());
        if (away) endTestRef.current("tab_switch");
      };
      if (wait <= 0) check();
      else leaveTimer.current = setTimeout(check, wait);
    }

    function onBlur() {
      leave();
      endIfStillAway(document.visibilityState === "hidden");
    }

    function back() {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
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
      if (document.visibilityState === "hidden") {
        leave();
        endIfStillAway(true);
      } else back();
    }

    function onFullscreenChange() {
      const on = Boolean(document.fullscreenElement);
      settleUntil.current = Date.now() + FULLSCREEN_SETTLE_MS;
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
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", back);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", back);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
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
      settleUntil.current = Date.now() + FULLSCREEN_SETTLE_MS;
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

  const { stop: stopCamera, reset: resetCamera } = camera;
  const cameraOn = camera.status === "on";

  /** Clears this hook's own counters and state. The camera keeps its own. */
  const resetOwn = React.useCallback(() => {
    stopped.current = false;
    examRef.current = false;
    leftAt.current = null;
    setSignals(EMPTY_SIGNALS);
    setAway(false);
    setNeedsAcknowledgement(false);
    setExamMode(false);
    setStarting(false);
    setFullscreen(false);
  }, []);

  /** Clears every counter and the camera, ready for a new attempt. */
  const reset = React.useCallback(() => {
    resetOwn();
    resetCamera();
  }, [resetOwn, resetCamera]);

  /**
   * Begins the supervised attempt. Must be called from a user gesture.
   *
   * There is no counterpart. Exam mode is mandatory for every graded answer,
   * so once it is on the only way out is submitting or leaving the page, and
   * leaving the page ends the test.
   */
  const start = React.useCallback(async () => {
    if (examRef.current || endedRef.current) return;

    /**
     * No camera, no test. Enforced here as well as by the gates' buttons, so
     * a surface that calls start() from its own handler cannot open a test
     * with the camera off — refusing the camera used to be the one way round
     * every camera rule, since an attempt that is not watched cannot be ended.
     */
    if (!cameraOn) return;

    /**
     * A previous attempt on this page already ended, so this is a new one.
     *
     * Several surfaces stay on the same page after a submit — SQL and Excel
     * show their gate again after a correct answer — and once start() was
     * allowed to re-arm, it re-armed with the last attempt's counters still in
     * place. Its tab-switches would then be submitted again with the next
     * attempt, and could push an honest one over the penalty line. The camera
     * clears its own counters when it is switched back on for the new attempt,
     * which the gate requires before this can run.
     */
    if (stopped.current) resetOwn();

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
  }, [bump, requestFullscreen, resetOwn, cameraOn]);

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
    stopCamera();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, [stopCamera]);

  /**
   * One object, so every surface's existing `signals: proctor.signals` carries
   * the camera too. Memoised on its inputs so the reference only changes when a
   * counter does.
   */
  const merged = React.useMemo<ProctorSignals>(
    () => ({ ...signals, ...camera.signals }),
    [signals, camera.signals],
  );
  const mergedRef = React.useRef(merged);
  React.useEffect(() => {
    mergedRef.current = merged;
  }, [merged]);

  // ---- the camera ends the test -------------------------------------------
  // Shown by ProctorEndedHost in the root layout, for as long as this page is.
  React.useEffect(() => {
    setEndedTest(ended);
    return () => setEndedTest(null);
  }, [ended]);

  /**
   * A lock from an earlier visit. Without this the freeze would last exactly
   * until the student pressed reload. Asked once per page; a failed lookup
   * leaves the page unlocked rather than refusing an honest student the test.
   */
  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const path = window.location.pathname;
    fetch(`/api/proctor/lockout?path=${encodeURIComponent(path)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((lock: { locked?: boolean; reason?: EndReason; at?: string } | null) => {
        if (cancelled || !lock?.locked || !lock.reason) return;
        endedRef.current = true;
        setEnded({ reason: lock.reason, at: lock.at ?? new Date().toISOString() });
        // The lookup can land after a quick Start press.
        if (examRef.current) stop();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, stop]);

  /**
   * Ends the attempt: freeze now, then record it.
   *
   * The freeze comes first and does not wait on the network. Stopping exam
   * mode releases the camera, fullscreen and the leave-page warning, and the
   * ended screen covers the whole page, so nothing more can be typed, clicked
   * or submitted. The lock is written afterwards — with keepalive, because a
   * tab switch ends the test while the page is hidden and may be closed next.
   * If it fails to arrive the page is still frozen until it is left.
   */
  const endTest = React.useCallback(
    (reason: EndReason) => {
      if (endedRef.current || !examRef.current) return;
      endedRef.current = true;
      setEnded({ reason, at: new Date().toISOString() });
      const report = { ...mergedRef.current };
      stop();
      void fetch("/api/proctor/lockout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: window.location.pathname, reason, signals: report }),
        keepalive: true,
      }).catch(() => {});
    },
    [stop],
  );
  React.useEffect(() => {
    endTestRef.current = endTest;
  }, [endTest]);

  // Something the camera saw.
  const violation = camera.violation;
  React.useEffect(() => {
    if (violation) endTest(violation);
  }, [violation, endTest]);

  return {
    signals: merged,
    camera,
    away,
    needsAcknowledgement,
    examMode,
    starting,
    fullscreen,
    ended,
    handlers,
    start,
    acknowledge,
    stop,
    reset,
  };
}
