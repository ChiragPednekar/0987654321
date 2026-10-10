"use client";

import { Camera, Eye, Loader2, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CameraApi } from "@/hooks/use-camera-proctor";

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

export const SIM_RULES = [
  "The page goes fullscreen while you play.",
  "Leaving the page is recorded with your run.",
  "The decisions are yours — the camera checks you are on your own.",
];

export const GD_RULES = [
  "The page goes fullscreen for the discussion.",
  "Leaving the page is recorded with your result.",
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
  const cameraFirst = camera !== undefined && camera.status === "idle";
  const waitingForCamera = camera !== undefined && !cameraFirst && !cameraReady(camera);

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
      {camera && <CameraConsent camera={camera} />}

      {cameraFirst ? (
        <Button className="mt-5" onClick={() => void camera.request()}>
          <Camera />
          Turn on camera
        </Button>
      ) : waitingForCamera ? (
        <Button className="mt-5" disabled>
          <Loader2 className="animate-spin" />
          Allow the camera in your browser…
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

/**
 * Whether a surface may start the attempt as far as the camera is concerned.
 *
 * Ready once the camera question has an answer — on, refused or unavailable —
 * or once the prompt has gone unanswered long enough that waiting longer would
 * be the camera stopping someone sitting the paper. Not ready while it has not
 * been asked at all, which is the point: the camera must be settled before the
 * start click goes fullscreen, because some browsers leave fullscreen to show a
 * permission prompt, and that exit is a penalised flag the student did nothing
 * to earn.
 */
export function cameraReady(camera: CameraApi): boolean {
  if (camera.status === "idle") return false;
  if (camera.status === "requesting") return camera.waitedTooLong;
  return true;
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
  if (camera.status === "on") return null;
  return (
    <div className="text-center">
      <CameraConsent camera={camera} />
      {camera.status === "idle" && (
        <Button className="mt-3" variant="outline" onClick={() => void camera.request()}>
          <Camera />
          Turn on camera
        </Button>
      )}
      {camera.status === "requesting" && !camera.waitedTooLong && (
        <Button className="mt-3" variant="outline" disabled>
          <Loader2 className="animate-spin" />
          Allow the camera in your browser…
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
    camera.status === "on"
      ? { tone: "text-success", text: "Camera is on." }
      : camera.status === "denied"
        ? {
            tone: "text-warning",
            text: "Camera access was refused. You can still start, but the attempt will be marked as taken with the camera off.",
          }
        : camera.status === "unavailable"
          ? {
              tone: "text-warning",
              text: "No camera could be used — it may be missing or open in another app. You can still start; this will be noted with the attempt.",
            }
          : camera.status === "requesting" && camera.waitedTooLong
            ? {
                tone: "text-warning",
                text: "Still waiting for camera permission. You can start without it; the attempt will be noted as taken with the camera off.",
              }
            : null;

  const canRetry = camera.status === "denied" || camera.status === "unavailable";

  return (
    <div className="mx-auto mt-4 max-w-sm rounded-md border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <Camera className="size-3.5" aria-hidden />
        Camera
      </p>
      <p className="mt-1.5">
        Your camera checks that you are on your own and that no phone is in
        view. The checks run on this laptop and no video is uploaded. If
        something is detected, one small photo is saved for a reviewer and
        deleted after 30 days.
      </p>
      {state && <p className={`mt-1.5 ${state.tone}`}>{state.text}</p>}
      {canRetry && (
        <button
          type="button"
          className="mt-1.5 underline underline-offset-2 hover:text-foreground"
          onClick={() => void camera.request()}
        >
          Try the camera again
        </button>
      )}
    </div>
  );
}
