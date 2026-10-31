"use client";

import { Camera, Eye, Loader2, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CameraApi } from "@/hooks/use-camera-proctor";
import { cameraReady } from "@/lib/proctor-readiness";
export { cameraReady } from "@/lib/proctor-readiness";

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
          be shown with your submission. Switching tabs, or staying in another
          window for more than two seconds, ends the test.
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
  "Switching tabs or leaving this window ends the test.",
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
  "Switching tabs or leaving this window ends the test.",
];

export const WORKBENCH_RULES = [
  "The page goes fullscreen while you work.",
  "Pasting is disabled. Type the query or formula yourself.",
  "Switching tabs or leaving this window ends the test.",
];

export const CONVERSATION_RULES = [
  "The page goes fullscreen for the whole session.",
  "Pasting is disabled. Answer in your own words.",
  "Switching tabs or leaving this window ends the session.",
];

export const SIM_RULES = [
  "The page goes fullscreen while you play.",
  "Switching tabs or leaving this window ends the run.",
  "The decisions are yours — the camera checks you are on your own.",
];

export const GD_RULES = [
  "The page goes fullscreen for the discussion.",
  "Switching tabs or leaving this window ends the discussion for you.",
  "Speak from your own preparation, not from another screen or a phone.",
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
  camera,
}: {
  starting: boolean;
  onStart: () => void | Promise<void>;
  resumed?: boolean;
  title?: string;
  rules?: readonly string[];
  /**
   * When given, the camera is asked for as its own step before Start.
   *
   * Its own button rather than folded into Start, because of the same rule
   * that makes Start a button at all: fullscreen is only granted inside a
   * fresh user gesture, and that gesture expires within seconds. Waiting on a
   * permission prompt inside Start would hand fullscreen a stale gesture
   * whenever a student took a moment to read the prompt — and lose it.
   */
  camera?: CameraApi;
}) {
  const waitingForCamera = camera !== undefined && (camera.status === "requesting" || (camera.status === "on" && camera.detector !== "failed" && !cameraReady(camera)));
  const cameraOff = camera !== undefined && !waitingForCamera && !cameraReady(camera);

  return (
    <div className="rounded-xl border bg-card p-6 text-center">
      <Lock className="mx-auto size-7 text-muted-foreground" />
      <h3 className="mt-3 font-medium">
        {resumed
          ? "Re-enter exam mode to carry on"
          : (title ?? "This case is answered under exam conditions")}
      </h3>
      <ul className="mx-auto mt-4 max-w-xl list-disc space-y-1.5 pl-5 text-left text-xs leading-relaxed text-muted-foreground">
        {rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      {camera && <CameraConsent camera={camera} />}

      {cameraOff ? (
        <Button className="mt-5" onClick={() => void camera.request()}>
          <Camera />
          {cameraRefused(camera) || camera.detector === "failed" ? "Try the camera again" : "Turn on camera"}
        </Button>
      ) : waitingForCamera ? (
        <Button className="mt-5" disabled>
          <Loader2 className="animate-spin" />
          {camera?.status === "on" ? "Loading camera checks…" : "Allow the camera in your browser…"}
        </Button>
      ) : (
        <Button className="mt-5" onClick={() => void onStart()} disabled={starting}>
          {starting ? <Loader2 className="animate-spin" /> : <Lock />}
          {starting ? "Starting…" : resumed ? "Resume" : "Start"}
        </Button>
      )}
    </div>
  );
}

/** The browser or the machine said no, as opposed to not having been asked. */
function cameraRefused(camera: CameraApi): boolean {
  return camera.status === "denied" || camera.status === "unavailable";
}

/**
 * The camera step for surfaces that start from their own button rather than
 * through ProctorGate — the contest timer and the aptitude paper, whose start
 * click also has to fire a network request in the same gesture.
 *
 * Render it above the start button and disable the button with
 * `!cameraReady(camera)`. Renders nothing once the camera is on, so the start
 * screen goes back to looking as it did.
 */
export function CameraStep({ camera }: { camera: CameraApi }) {
  if (cameraReady(camera)) return null;
  const loadingChecks = camera.status === "on" && camera.detector !== "failed";
  return (
    <div className="text-center">
      <CameraConsent camera={camera} />
      {camera.status !== "requesting" && !loadingChecks && (
        <Button className="mt-3" variant="outline" onClick={() => void camera.request()}>
          <Camera />
          {cameraRefused(camera) || camera.detector === "failed" ? "Try the camera again" : "Turn on camera"}
        </Button>
      )}
      {(camera.status === "requesting" || loadingChecks) && (
        <Button className="mt-3" variant="outline" disabled>
          <Loader2 className="animate-spin" />
          {loadingChecks ? "Loading camera checks…" : "Allow the camera in your browser…"}
        </Button>
      )}
    </div>
  );
}

/**
 * What the camera does, said before it is switched on.
 *
 * This is the notice the student consents against, so it says the three
 * things that matter for that: what is checked, that the checking happens on
 * their own laptop, and exactly what — if anything — is kept and for how long.
 * Anything vaguer would not be consent to anything in particular.
 */
function CameraConsent({ camera }: { camera: CameraApi }) {
  const state =
    camera.status === "on" && camera.detector === "failed"
      ? { tone: "text-danger", text: "Camera checks could not load. Check your connection and try the camera again. The test has not started." }
      : camera.status === "on"
      ? { tone: "text-success", text: "Camera is on." }
      : camera.status === "denied"
        ? {
            tone: "text-danger",
            text: "Camera access was refused. The test cannot start without the camera — allow it for this site in your browser's settings, then try again.",
          }
        : camera.status === "unavailable"
          ? {
              tone: "text-danger",
              text: "No camera could be used — it may be missing, or open in another app such as Zoom or Teams. The test cannot start without one.",
            }
          : camera.status === "requesting" && camera.waitedTooLong
            ? {
                tone: "text-warning",
                text: "Still waiting for camera permission — look for the prompt next to your browser's address bar.",
              }
            : null;

  return (
    <div className="mx-auto mt-4 max-w-xl rounded-md border bg-muted/40 p-4 text-left text-xs leading-relaxed text-muted-foreground">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <Camera className="size-3.5" aria-hidden />
        Camera & Microphone
      </p>
      <p className="mt-1.5">
        Your camera and microphone check that you are on your own, facing the screen, and that
        no phone or voice dictation is present. The checks run on this laptop and no continuous video or audio is uploaded. If
        something is detected, evidence is saved for a reviewer and deleted after 30 days.
      </p>
      {/*
        Said before Start, in full, because it is the rule with the hardest
        consequence: nobody should learn that a phone ends the test by having
        their test ended.
      */}
      <p className="mt-1.5 font-medium text-foreground">
        The camera and microphone must stay active for the whole test. Your test ends at once,
        and cannot be continued, if you switch tabs or leave this window, a
        phone or another person is seen, you look away repeatedly, speech is detected, the camera is covered or switched
        off, or you are out of view for over a minute. The question is then
        blocked for 24 hours; the second time it is ended, it is blocked permanently.
      </p>
      {camera.signals.micDenied && (
        <p className="mt-1.5 font-medium text-[var(--warning,#d97706)]">
          Microphone access was refused — voice detection requires microphone access and this refusal will be flagged for your reviewer.
        </p>
      )}
      {state && <p className={`mt-1.5 ${state.tone}`}>{state.text}</p>}
    </div>
  );
}
