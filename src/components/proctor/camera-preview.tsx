"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CameraOff, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CameraApi } from "@/hooks/use-camera-proctor";

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

  if (!on) {
    return createPortal(
      <div
        className="fixed bottom-4 right-4 z-40 flex max-w-[16rem] items-center gap-2 rounded-lg border border-warning-border bg-warning-surface px-3 py-2 text-xs text-foreground shadow-sm"
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

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-40 w-40 overflow-hidden rounded-lg border bg-card shadow-sm"
      role="status"
      aria-label="Camera"
    >
      {open && (
        // Mirrored, because that is how people expect to see themselves.
        // Detection reads the unmirrored stream; this only changes the picture.
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="aspect-[4/3] w-full -scale-x-100 bg-muted object-cover"
        />
      )}
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px]">
        <span
          className={`size-1.5 shrink-0 rounded-full ${note.ok ? "bg-success" : "bg-warning"}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{note.text}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={open ? "Hide camera preview" : "Show camera preview"}
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </button>
      </div>
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
  if (live.faces === 0) return { ok: false, text: "No face in view" };
  if (live.faces > 1) return { ok: false, text: "More than one person in view" };
  return { ok: true, text: "Camera on" };
}

