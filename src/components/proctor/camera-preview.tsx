"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CameraOff, ChevronDown, ChevronUp, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CameraApi } from "@/hooks/use-camera-proctor";
import { useBrowserValue } from "@/hooks/use-browser-state";

/**
 * The student's own view of what the camera sees, pinned to a corner.
 *
 * Shown deliberately, not hidden. A student who can see the frame knows exactly
 * what is being checked, can move the phone out of shot or turn on a light
 * before anything is counted, and is not left guessing what a hidden camera
 * recorded. The checks below are the same ones the tracker counts, said as
 * they happen — telling an honest student "phone in view" while they can still
 * put it away is fairer than telling them afterwards.
 *
 * Minimising hides the picture, not the checks: detection runs on its own
 * invisible video element in use-camera-proctor.ts.
 *
 * Portalled to <body>. The surfaces render this inside containers using
 * `space-y-*`, which adds a bottom margin to every child — and on a fixed
 * element that margin shifts it off its corner. Rendering at the body keeps
 * it out of whatever layout the surface happens to use. Safe during SSR,
 * because the status is always "idle" there and this returns before the
 * portal is reached.
 */
export function CameraPreview({ camera }: { camera: CameraApi }) {
  const [open, setOpen] = React.useState(true);
  const debug = useBrowserValue(
    () => new URLSearchParams(window.location.search).has("camera-debug"),
    false,
  );
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = camera.stream;
    if (camera.stream) void video.play().catch(() => {});
  }, [camera.stream, open]);

  if (camera.status === "idle" || camera.status === "stopped") return null;

  const on = camera.status === "on";
  const note = describe(camera);
  const audioLevel = camera.live?.audioLevel ?? 0;
  const hasGazeStrikes = camera.signals.lookingAwayEvents > 0 || Boolean(camera.live?.lookingAway);
  const hasVoiceStrikes = camera.signals.voiceEvents > 0 || Boolean(camera.live?.voiceDetected);

  if (!on) {
    return createPortal(
      <div
        className="fixed bottom-4 right-4 z-40 flex max-w-[17rem] items-center gap-2 rounded-xl border border-warning-border bg-warning-surface px-3 py-2 text-xs text-foreground shadow-sm"
        role="status"
      >
        <CameraOff className="size-4 shrink-0 text-warning" aria-hidden />
        <span className="min-w-0 flex-1">{note.text}</span>
        {camera.status !== "requesting" && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => void camera.request()}>
            Turn on
          </Button>
        )}
      </div>,
      document.body,
    );
  }

  const borderClass = !note.ok
    ? "border-amber-500/60 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30"
    : "border-border shadow-sm";

  return createPortal(
    <div
      className={`fixed bottom-4 right-4 z-40 w-48 overflow-hidden rounded-xl border bg-card transition-all duration-200 ${borderClass}`}
      role="status"
      aria-label="Proctored Camera Preview"
    >
      {open && (
        // Mirrored, because that is how people expect to see themselves.
        // Detection reads the unmirrored stream; this only changes the picture.
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className="size-full -scale-x-100 object-cover"
          />
          {/* Subtle live recording badge */}
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
            <span className="size-1.5 animate-pulse rounded-full bg-rose-500" />
            <span>REC</span>
          </div>

          {/* Audio level indicator over video */}
          {camera.signals.micGranted && (
            <div
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] text-white backdrop-blur-sm"
              title={`Microphone active: ${audioLevel}%`}
            >
              <Mic className="size-2.5 text-white/80" />
              <div className="flex items-center gap-0.5">
                <span
                  className={`size-1 rounded-full ${
                    audioLevel > 12 ? (audioLevel > 45 ? "bg-amber-400" : "bg-emerald-400") : "bg-white/30"
                  }`}
                />
                <span
                  className={`size-1 rounded-full ${
                    audioLevel > 30 ? (audioLevel > 60 ? "bg-amber-400" : "bg-emerald-400") : "bg-white/30"
                  }`}
                />
                <span
                  className={`size-1 rounded-full ${audioLevel > 55 ? "bg-rose-400" : "bg-white/30"}`}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main status header bar */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px]">
        <span
          className={`size-1.5 shrink-0 rounded-full ${note.ok ? "bg-success" : "bg-warning animate-pulse"}`}
          aria-hidden
        />
        <span
          className={`min-w-0 flex-1 truncate ${
            note.ok ? "text-muted-foreground" : "font-medium text-amber-600 dark:text-amber-400"
          }`}
          title={note.text}
        >
          {note.text}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={open ? "Hide camera preview" : "Show camera preview"}
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </button>
      </div>

      {/* Gaze tracking strike meter (5 benefit-of-doubt chances) */}
      {hasGazeStrikes && (
        <div className="flex items-center justify-between border-t border-border/40 bg-muted/30 px-2.5 py-1 text-[10px]">
          <span className="text-muted-foreground">Screen gaze</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full transition-colors ${
                  i < camera.signals.lookingAwayEvents
                    ? i >= 4
                      ? "bg-rose-500 animate-pulse"
                      : "bg-amber-500"
                    : "bg-muted-foreground/25"
                }`}
              />
            ))}
            <span className="ml-1 font-mono text-[9px] text-muted-foreground">
              {camera.signals.lookingAwayEvents}/5
            </span>
          </div>
        </div>
      )}

      {/* Voice tracking strike meter (3 benefit-of-doubt chances) */}
      {hasVoiceStrikes && (
        <div className="flex items-center justify-between border-t border-border/40 bg-muted/30 px-2.5 py-1 text-[10px]">
          <span className="text-muted-foreground">Voice / audio</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full transition-colors ${
                  i < camera.signals.voiceEvents
                    ? i >= 2
                      ? "bg-rose-500 animate-pulse"
                      : "bg-amber-500"
                    : "bg-muted-foreground/25"
                }`}
              />
            ))}
            <span className="ml-1 font-mono text-[9px] text-muted-foreground">
              {camera.signals.voiceEvents}/3
            </span>
          </div>
        </div>
      )}

      {/*
        Diagnostics, only with ?camera-debug in the address: what the models
        are reporting, sample by sample. For checking a real webcam and room
        against the thresholds — not shown to students otherwise.
      */}
      {debug && (
        <div className="border-t border-border/60 bg-muted/50 px-2 py-1.5 font-mono text-[9px] text-muted-foreground space-y-0.5">
          <p>
            <span className="font-semibold text-foreground">{camera.detector}</span> · faces {camera.live?.faces ?? "–"} · {camera.live?.gazeState ?? "NORMAL"}
          </p>
          {camera.live?.headPose && (
            <p>
              pose: Y:{camera.live.headPose.yaw.toFixed(1)}° P:{camera.live.headPose.pitch.toFixed(1)}° R:{camera.live.headPose.roll.toFixed(1)}°
            </p>
          )}
          {camera.live?.irisMetrics && (
            <p>
              iris: ({camera.live.irisMetrics.x.toFixed(2)}, {camera.live.irisMetrics.y.toFixed(2)}) · EAR: {camera.live.irisMetrics.ear.toFixed(2)}
            </p>
          )}
          <p>
            vad: {camera.live?.speechProbability ? (camera.live.speechProbability * 100).toFixed(0) : "0"}% · snr: {camera.live?.snrDb?.toFixed(1) ?? "0"}dB · sfm: {camera.live?.spectralFlatness?.toFixed(2) ?? "–"}
          </p>
          <p>
            strikes: gaze {camera.signals.lookingAwayEvents}/5 · voice {camera.signals.voiceEvents}/3 · lvl {audioLevel}
          </p>
        </div>
      )}
    </div>,
    document.body,
  );
}

function describe(camera: CameraApi): { ok: boolean; text: string } {
  switch (camera.status) {
    case "requesting":
      return { ok: false, text: "Waiting for camera permission…" };
    case "denied":
      return { ok: false, text: "Camera off — this is recorded with your attempt." };
    case "unavailable":
      return { ok: false, text: "No camera available — this is recorded with your attempt." };
    case "lost":
      return { ok: false, text: "Camera stopped — turn it back on." };
    default:
      break;
  }

  if (camera.detector === "loading") return { ok: true, text: "Starting camera checks…" };
  if (camera.detector === "failed") return { ok: true, text: "Camera on · checks unavailable here" };

  const live = camera.live;
  if (!live) return { ok: true, text: "Camera on" };
  if (live.covered) return { ok: false, text: "Camera view is blocked" };
  if (live.phone) return { ok: false, text: "Phone in view — put it away" };
  if (live.faces > 1) return { ok: false, text: "More than one person in view" };

  // Voice detection: 3 warnings before test suspension
  if (live.voiceDetected || (live.voiceCount > 0 && live.voiceCount <= 3)) {
    const count = Math.min(3, Math.max(1, live.voiceCount));
    const prefix = count === 3 ? "Final warning" : `Warning ${count} of 3`;
    const voiceAlert =
      live.voiceCount > 0
        ? `Voice detected — ${prefix} (Please remain silent)`
        : `Voice detected — Please remain silent`;
    return {
      ok: false,
      text: voiceAlert,
    };
  }

  // Looking away / facing screen: 5 warnings before test suspension
  if (live.lookingAway || (live.lookingAwayCount > 0 && live.lookingAwayCount <= 5)) {
    const count = Math.min(5, Math.max(1, live.lookingAwayCount));
    const prefix = count === 5 ? "Final warning" : `Warning ${count} of 5`;
    const tip = live.lookingAwayTip ?? "Please face the screen";
    const alertText =
      live.lookingAwayCount > 0 ? `${tip} (${prefix})` : `${tip} — Please face the screen`;
    return {
      ok: false,
      text: alertText,
    };
  }

  if (live.faces === 0) return { ok: false, text: "No face in view" };
  return { ok: true, text: camera.signals.micGranted ? "Camera & mic on" : "Camera on" };
}
