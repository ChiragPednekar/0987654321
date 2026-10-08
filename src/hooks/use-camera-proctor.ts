"use client";

import * as React from "react";
import type { FaceDetector, ObjectDetector } from "@mediapipe/tasks-vision";
import {
  createTracker,
  isCovered,
  observe,
  SAMPLE_INTERVAL_MS,
  type CameraCounters,
  type SnapshotKind,
  type TrackerState,
} from "@/lib/camera-proctor";

/**
 * Watches the webcam during a proctored attempt.
 *
 * ---------------------------------------------------------------------------
 * Nothing leaves the laptop except counters
 * ---------------------------------------------------------------------------
 * Detection runs in the browser on the student's own CPU. No video is
 * streamed or uploaded; what reaches the server is the handful of numbers in
 * CameraCounters, carried with the submission like every other proctor signal.
 * The one exception is a single low-resolution photo at the moment a finding
 * starts — capped per attempt, stored privately, deleted after 30 days — so a
 * reviewer can see what the model saw instead of taking its word for it.
 *
 * That is also why it costs nothing to run: no server, no model API, no
 * per-student spend.
 *
 * ---------------------------------------------------------------------------
 * What it cannot do
 * ---------------------------------------------------------------------------
 * The same as every other browser signal: a student with devtools can stop it
 * or post any numbers they like, and a phone held below the desk is simply not
 * in frame. Turning the camera off or covering it is itself recorded, but none
 * of this is proof, which is why src/lib/integrity.ts lets camera findings put
 * an attempt in front of a reviewer and never lets them move a mark.
 */

export type CameraStatus =
  /** Not asked for yet. */
  | "idle"
  /** The browser's permission prompt is open. */
  | "requesting"
  | "on"
  | "denied"
  /** No camera, no browser support, or the camera is held by another app. */
  | "unavailable"
  /** It was on and stopped mid-attempt. */
  | "lost"
  /** Turned off deliberately when the attempt ended. */
  | "stopped";

export type DetectorStatus = "idle" | "loading" | "ready" | "failed";

/** What is in view right now — only for the preview's own feedback. */
export interface LiveView {
  faces: number;
  phone: boolean;
  covered: boolean;
}

export interface CameraSignals extends CameraCounters {
  cameraRequested: boolean;
  cameraGranted: boolean;
  cameraDenied: boolean;
  cameraUnavailable: boolean;
  cameraLostCount: number;
  detectorFailed: boolean;
}

export interface CameraApi {
  status: CameraStatus;
  detector: DetectorStatus;
  stream: MediaStream | null;
  live: LiveView | null;
  signals: CameraSignals;
  /**
   * The permission prompt has been open long enough that the student should be
   * allowed to start without it. Some browsers leave the request pending with
   * no answer at all if the prompt is ignored, and a camera nobody can switch on
   * must not be able to stop someone sitting the paper.
   */
  waitedTooLong: boolean;
  /** Asks for the camera. Call from a button press so the prompt has a reason to appear. */
  request: () => Promise<void>;
  /** Stops the camera and freezes the counters. */
  stop: () => void;
  /** Resets camera state and counters for a fresh attempt. */
  reset: () => void;
}

/** Served from /public: wasm copied out of node_modules at build, models committed. */
const WASM_BASE = "/proctor/wasm";
const FACE_MODEL = "/proctor/models/blaze_face_short_range.tflite";
/**
 * EfficientDet-Lite2, not the smaller Lite0, chosen on measurement. Run against
 * the same photos, Lite2 scored a real phone 0.50 where Lite0 scored 0.41, and
 * stopped reporting a phantom phone on a plain portrait (Lite0: 0.12). It costs
 * roughly 150ms a frame against 55ms — about a tenth of one core at one frame
 * every 1.5s. Neither model sees a dark phone held up back-first at arm's
 * length, and no threshold recovers that without inventing phones elsewhere;
 * that limit is stated in the plan, not hidden.
 */
const OBJECT_MODEL = "/proctor/models/efficientdet_lite2.tflite";

/** How long the permission prompt may sit unanswered before Start unlocks anyway. */
const PROMPT_PATIENCE_MS = 15_000;

/** Evidence photos per attempt, and the gap between two of the same kind. */
const MAX_SNAPSHOTS = 6;
const SNAPSHOT_GAP_MS = 60_000;

/** Width of an evidence photo. Enough to see a phone, not enough to read a page. */
const SNAPSHOT_WIDTH = 320;

const EMPTY_STATE_SIGNALS: CameraSignals = {
  cameraRequested: false,
  cameraGranted: false,
  cameraDenied: false,
  cameraUnavailable: false,
  cameraLostCount: 0,
  detectorFailed: false,
  ...createTracker().counters,
};

interface Detectors {
  face: FaceDetector;
  objects: ObjectDetector;
}

/**
 * Mutes one line the TFLite runtime prints on its first inference:
 * "INFO: Created TensorFlow Lite XNNPACK delegate for CPU." It goes through
 * console.error, so Next's dev overlay counts it as an issue and a browser
 * console shows it in red, though nothing is wrong.
 *
 * It has to be installed for the whole load, not just around an inference: the
 * Emscripten runtime takes its own reference to console.error when the module
 * initialises and keeps that reference for life, so patching console.error
 * afterwards does not reach it. With this in place during load, the runtime
 * captures the filter instead — which forwards everything else untouched.
 */
function muteRuntimeInfo(): () => void {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("INFO: Created TensorFlow Lite")) return;
    original(...args);
  };
  return () => {
    console.error = original;
  };
}

async function loadDetectors(): Promise<Detectors> {
  const restore = muteRuntimeInfo();
  try {
    return await loadDetectorsUnmuted();
  } finally {
    restore();
  }
}

async function loadDetectorsUnmuted(): Promise<Detectors> {
  // Imported here, not at the top of the file: the library and its models are
  // megabytes, and only a page that has actually started an exam should pay.
  const { FilesetResolver, FaceDetector, ObjectDetector } = await import(
    "@mediapipe/tasks-vision"
  );
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);

  /**
   * CPU, not GPU. One frame every 1.5 seconds is a few tens of milliseconds of
   * CPU on any laptop sold in the last decade, while the GPU delegate depends
   * on WebGL state that varies by driver and can be lost mid-attempt. For an
   * exam the predictable path is worth more than the fast one.
   */
  const [face, objects] = await Promise.all([
    FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: "CPU" },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
    }),
    ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: OBJECT_MODEL, delegate: "CPU" },
      runningMode: "VIDEO",
      // Low-ish on purpose: this model scores phones modestly, and the
      // 3-in-5 debounce in camera-proctor.ts is what stops one bad frame
      // becoming an event.
      scoreThreshold: 0.4,
      maxResults: 5,
      categoryAllowlist: ["cell phone", "book"],
    }),
  ]);

  warmUp(face, objects);
  return { face, objects };
}

/**
 * Runs each model once on a blank frame while the load is still muted, so the
 * runtime's one-time startup line is printed — and swallowed — here rather
 * than during the exam. Also moves the first-inference cost off the first real
 * sample.
 */
function warmUp(face: FaceDetector, objects: ObjectDetector) {
  const blank = document.createElement("canvas");
  blank.width = 64;
  blank.height = 48;
  blank.getContext("2d")?.fillRect(0, 0, 64, 48);
  try {
    const t = performance.now();
    face.detectForVideo(blank, t);
    objects.detectForVideo(blank, t);
  } catch {
    // A model that cannot read a blank frame will say so on the first real
    // one, where `sample` already handles it.
  }
}

function classify(error: unknown): "denied" | "unavailable" {
  const name = error instanceof DOMException ? error.name : "";
  // NotAllowedError: the student or an OS privacy setting said no.
  // SecurityError: the page is not allowed to ask (permissions policy).
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  // NotFoundError, OverconstrainedError, and NotReadableError — the last being
  // a camera already held by Zoom or Teams, which is not the student refusing.
  return "unavailable";
}

/**
 * `counting` is true only while the attempt is under way.
 *
 * The camera is switched on from the start screen — it has to be, so the
 * permission prompt is settled before the start click goes fullscreen — but
 * nothing may be counted until the attempt begins. A phone on the desk while a
 * student reads the instructions is not an event in an exam they have not
 * started, and the preview that would warn them is not even on screen yet.
 */
export function useCameraProctor(enabled: boolean, counting: boolean): CameraApi {
  const [status, setStatus] = React.useState<CameraStatus>("idle");
  const [detector, setDetector] = React.useState<DetectorStatus>("idle");
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [live, setLive] = React.useState<LiveView | null>(null);
  const [signals, setSignals] = React.useState<CameraSignals>(EMPTY_STATE_SIGNALS);
  const [waitedTooLong, setWaitedTooLong] = React.useState(false);

  const stopped = React.useRef(false);
  const streamRef = React.useRef<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const detectorsRef = React.useRef<Detectors | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const trackerRef = React.useRef<TrackerState>(createTracker());
  const lastSampleAt = React.useRef<number | null>(null);
  const snapshots = React.useRef({ taken: 0, lastByKind: {} as Partial<Record<SnapshotKind, number>> });
  const countingRef = React.useRef(counting);

  React.useEffect(() => {
    // Restart the clock when counting begins, so the first sample does not
    // credit the time spent on the start screen.
    if (counting && !countingRef.current) lastSampleAt.current = null;
    countingRef.current = counting;
  }, [counting]);

  const patch = React.useCallback((p: Partial<CameraSignals>) => {
    if (stopped.current) return;
    setSignals((s) => ({ ...s, ...p }));
  }, []);

  /** Releases the camera and the models. Safe to call twice. */
  const teardown = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    videoRef.current?.remove();
    videoRef.current = null;
    try {
      detectorsRef.current?.face.close();
      detectorsRef.current?.objects.close();
    } catch {
      // Closing a half-initialised detector can throw; there is nothing to do.
    }
    detectorsRef.current = null;
    setStream(null);
    setLive(null);
  }, []);

  /**
   * One photo of the moment a finding started.
   *
   * Fire and forget: evidence that fails to upload must never interrupt the
   * attempt, and the counter is recorded either way.
   */
  const captureSnapshot = React.useCallback((kind: SnapshotKind) => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const now = Date.now();
    const s = snapshots.current;
    const last = s.lastByKind[kind];
    if (s.taken >= MAX_SNAPSHOTS) return;
    if (last !== undefined && now - last < SNAPSHOT_GAP_MS) return;
    s.taken += 1;
    s.lastByKind[kind] = now;

    const canvas = document.createElement("canvas");
    canvas.width = SNAPSHOT_WIDTH;
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * SNAPSHOT_WIDTH);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = () => {
          const image = String(reader.result).split(",")[1] ?? "";
          void fetch("/api/proctor/snapshot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, image }),
          }).catch(() => {});
        };
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      0.6,
    );
  }, []);

  const sample = React.useCallback(() => {
    const video = videoRef.current;
    const detectors = detectorsRef.current;
    if (stopped.current || !video || !detectors || video.readyState < 2) return;
    if (!countingRef.current) return;

    const now = performance.now();
    const elapsed = lastSampleAt.current === null ? SAMPLE_INTERVAL_MS : now - lastSampleAt.current;
    lastSampleAt.current = now;

    // Brightness first: it is a few hundred additions, and when the lens is
    // covered there is no point paying for two models to look at black.
    const canvas = (canvasRef.current ??= document.createElement("canvas"));
    canvas.width = 32;
    canvas.height = 24;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 32, 24);
    const covered = isCovered(ctx.getImageData(0, 0, 32, 24).data);

    let faces = 0;
    let phone = false;
    let book = false;

    if (!covered) {
      try {
        faces = detectors.face.detectForVideo(video, now).detections.length;
        for (const d of detectors.objects.detectForVideo(video, now).detections) {
          const name = d.categories[0]?.categoryName;
          if (name === "cell phone") phone = true;
          else if (name === "book") book = true;
        }
      } catch {
        // A frame the models choke on is skipped, not counted as anything.
        return;
      }
    }

    const { state, started } = observe(trackerRef.current, { faces, phone, book, covered }, elapsed);
    trackerRef.current = state;
    setLive({ faces, phone, covered });
    patch({ ...state.counters });
    for (const kind of started) captureSnapshot(kind);
  }, [patch, captureSnapshot]);

  const request = React.useCallback(async () => {
    if (!enabled) return;
    stopped.current = false;
    if (status === "requesting" || status === "on") return;

    patch({ cameraRequested: true, cameraDenied: false, cameraUnavailable: false });
    setStatus("requesting");
    setWaitedTooLong(false);
    const patience = setTimeout(() => setWaitedTooLong(true), PROMPT_PATIENCE_MS);

    let media: MediaStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("", "NotFoundError");
      /**
       * 1280×720, not 640×480. Measured: the same phone scored 0.57 from a
       * 960px frame, 0.37 from 640px and 0.33 from 480px — so a 640px request
       * pushed a real phone under the 0.4 threshold. 720p is what laptop
       * webcams deliver natively, and the extra pixels are nearly free here:
       * the models downscale internally and only one frame in 1.5s is read.
       * "ideal", so a camera that cannot do 720p still opens at what it can.
       */
      media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
    } catch (error) {
      clearTimeout(patience);
      const outcome = classify(error);
      setStatus(outcome);
      patch(outcome === "denied" ? { cameraDenied: true } : { cameraUnavailable: true });
      return;
    }
    clearTimeout(patience);

    // The attempt may have ended while the prompt was open.
    if (stopped.current) {
      media.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = media;
    setStream(media);
    setStatus("on");
    patch({ cameraGranted: true });

    media.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (stopped.current) return;
        setStatus("lost");
        setSignals((s) => ({ ...s, cameraLostCount: s.cameraLostCount + 1 }));
        teardown();
      });
    });

    /**
     * A dedicated video element for the models, kept in the DOM but invisible.
     * The preview the student sees is a separate element on the same stream,
     * so detection keeps running if they minimise the preview — and Safari
     * will not decode frames for a video that is not attached to the page.
     */
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");
    Object.assign(video.style, {
      position: "fixed",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
      left: "0",
      top: "0",
    });
    video.srcObject = media;
    document.body.appendChild(video);
    videoRef.current = video;
    void video.play().catch(() => {});

    setDetector("loading");
    try {
      const loaded = await loadDetectors();
      if (stopped.current || !streamRef.current) {
        loaded.face.close();
        loaded.objects.close();
        return;
      }
      detectorsRef.current = loaded;
      setDetector("ready");
      timerRef.current = setInterval(sample, SAMPLE_INTERVAL_MS);
    } catch (error) {
      // The camera is on but nothing can be analysed. Recorded, so a reviewer
      // does not read an absence of findings as a clean attempt.
      console.error("[camera] detection could not start", error);
      setDetector("failed");
      patch({ detectorFailed: true });
    }
  }, [enabled, status, patch, sample, teardown]);

  const reset = React.useCallback(() => {
    stopped.current = false;
    teardown();
    setStatus("idle");
    setStream(null);
    setLive(null);
    setSignals(EMPTY_STATE_SIGNALS);
    trackerRef.current = createTracker();
    lastSampleAt.current = null;
    snapshots.current = { taken: 0, lastByKind: {} };
    setWaitedTooLong(false);
  }, [teardown]);

  const stop = React.useCallback(() => {
    if (stopped.current) return;
    stopped.current = true;
    teardown();
    setStatus((s) => (s === "idle" ? s : "stopped"));
  }, [teardown]);

  // Leaving the page must release the camera, or the light stays on.
  React.useEffect(() => () => teardown(), [teardown]);

  return { status, detector, stream, live, signals, waitedTooLong, request, stop, reset };
}
