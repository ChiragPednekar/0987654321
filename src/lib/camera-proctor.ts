/**
 * What the camera saw, reduced to counters.
 *
 * Deliberately pure — no DOM, no MediaPipe, no React — because this is the part
 * that decides what counts as an event, and it is the part worth testing. The
 * hook in src/hooks/use-camera-proctor.ts does the capturing and calls
 * `observe()` once per sample; everything below is arithmetic on its answers.
 *
 * ---------------------------------------------------------------------------
 * Why everything is debounced
 * ---------------------------------------------------------------------------
 * A single frame is not evidence. The object model will call a dark mug a phone
 * for one frame, a face turned to read the page drops below the detector's
 * confidence for one frame, and a sibling crossing the room is in shot for one
 * frame. So nothing here reacts to a frame. Each condition keeps the last
 * WINDOW samples and only becomes true once it is seen in ACTIVATE_AT of them,
 * and only becomes false again once it has dropped to RELEASE_AT — hysteresis,
 * so a condition hovering at the threshold is one event rather than ten.
 *
 * Every window is defined in TIME and converted to a sample count, so changing
 * the sampling rate changes how finely a moment is seen, never how long it
 * has to last: most conditions need roughly 4.5 seconds in view across a
 * 7.5-second span before anything is counted, at any rate.
 *
 * A phone needs only about 3 seconds of sightings in the window. Measured on a
 * real webcam, the object model's confidence for a phone held in front of the
 * camera hovers around its threshold — in shot for ten seconds, it is seen in
 * some frames and missed in others — so the 4.5-second bar was rarely reached
 * and phones went unnoticed. Three seconds still ignores a misread frame.
 *
 * Looking away and voice are different: they arrive ALREADY debounced. The
 * gaze tracker only reports looking away once the gaze has stayed off-screen
 * for its dwell time (src/lib/gaze-tracker.ts), and the voice detector only
 * reports speech sustained for its minimum utterance length
 * (src/lib/audio-vad.ts). Debouncing those a second time here is what made a
 * glance or a short question to an assistant disappear, so they switch on at
 * the first confirmed sample and only need a short quiet spell to release.
 */

/**
 * One camera sample every 750 ms. At 1.5 s a one-second glance at a phone or
 * at notes fell entirely between two frames; at 750 ms it is seen. The models
 * run on the student's own CPU, so this is the fastest rate that stays light
 * on an ordinary laptop.
 */
export const SAMPLE_INTERVAL_MS = 750;

/** A duration as a whole number of samples, at least one. */
const samples = (ms: number) => Math.max(1, Math.round(ms / SAMPLE_INTERVAL_MS));

/** Samples kept per condition: 7.5 seconds. */
const WINDOW = samples(7_500);
/** Hits in the window needed to switch a condition on: about 4.5 seconds. */
const ACTIVATE_AT = samples(4_500);
/** The same, for a phone: about 3 seconds. See "Why everything is debounced". */
const PHONE_ACTIVATE_AT = samples(3_000);
/** The same, for a covered or blocked lens: about 3 seconds. */
const COVERED_ACTIVATE_AT = samples(3_000);
/** Hits in the window at or below which it switches off again: about 1.5 seconds. */
const RELEASE_AT = samples(1_500);

/**
 * Looking away and voice, which arrive already debounced (see above): on at
 * the first confirmed sample, off once nothing has been confirmed for about
 * two seconds, so a second, separate episode is a second event.
 */
const CONFIRMED_WINDOW = samples(2_250);
const CONFIRMED_ACTIVATE_AT = 1;
const CONFIRMED_RELEASE_AT = 0;

import {
  extractHeadPose,
  extractIrisGazeRatio,
  type GazeDetectionState,
  type NormalizedLandmark,
} from "@/lib/gaze-tracker";
import { DEFAULT_PROCTOR_CONFIG } from "@/lib/proctor-config";

/** Looking away: the test is suspended on the 5th strike — the counter reads 5/5. */
export const MAX_LOOKING_AWAY_STRIKES = 5;
/** Voice: the test is suspended on the 3rd strike — the counter reads 3/3. */
export const MAX_VOICE_STRIKES = 3;

/**
 * Too dark to see the student. A frame whose average brightness (0–255) is
 * below DARK_MEAN is too dark to watch whatever is in it; below DIM_MEAN it
 * counts as too dark only when the face detector also cannot find anyone —
 * a dim room is fine if the student can still be seen.
 */
export const DARK_MEAN = 40;
export const DIM_MEAN = 70;
/** Continuous time too dark to see that ends the attempt. The student is warned from the first moment. */
export const TOO_DARK_END_MS = 15_000;

/** Normalized landmark keypoint from face detector. */
export interface FaceKeypoint {
  x: number;
  y: number;
  z?: number;
}

/** Calibrated natural resting head pose baseline. */
export interface PoseBaseline {
  vMouth: number;
  yawDelta: number;
  roll?: number;
  headYaw?: number;
  headPitch?: number;
  irisX?: number;
  irisY?: number;
}

export interface PoseCheckResult {
  facing: boolean;
  state?: GazeDetectionState;
  reason?: "looking_left" | "looking_right" | "looking_down" | "looking_up" | "head_tilted" | "face_not_visible" | "tracking_uncertain";
  tip?: string;
  confidence?: number;
  metrics?: {
    yaw: number;
    pitch: number;
    roll: number;
    irisX?: number;
    irisY?: number;
    ear?: number;
    combinedYaw?: number;
    combinedPitch?: number;
  };
}

/**
 * Calculates head pose and gaze orientation from facial landmarks.
 * Supports:
 * - 478 MediaPipe FaceMesh + Iris landmarks (high-precision 3D gaze, EAR blink detection)
 * - 6 BlazeFace keypoints fallback (lightweight 2D pose estimation)
 * - Optional baseline calibrates against student's natural resting desk posture.
 */
export function checkPoseAndGaze(
  keypoints?: (FaceKeypoint | NormalizedLandmark)[] | null,
  baseline?: PoseBaseline | null,
  transformationMatrix?: number[] | null,
  blendshapes?: Array<{ categoryName: string; score: number }> | null,
): PoseCheckResult {
  if (!keypoints || keypoints.length < 4) return { facing: true };

  // Full 468/478 FaceLandmarker with iris keypoints
  if (keypoints.length >= 400) {
    const rawPose = extractHeadPose(keypoints as NormalizedLandmark[], transformationMatrix);
    const { irisX, irisY, earAvg, blinking } = extractIrisGazeRatio(keypoints as NormalizedLandmark[]);

    let blinkConfirmed = blinking;
    if (blendshapes && blendshapes.length > 0) {
      const bL = blendshapes.find((b) => b.categoryName === "eyeBlinkLeft")?.score ?? 0;
      const bR = blendshapes.find((b) => b.categoryName === "eyeBlinkRight")?.score ?? 0;
      if (bL > DEFAULT_PROCTOR_CONFIG.gaze.blinkBlendshapeThreshold || bR > DEFAULT_PROCTOR_CONFIG.gaze.blinkBlendshapeThreshold) {
        blinkConfirmed = true;
      }
    }

    // Baseline calibration offsets
    const baseYaw = baseline?.headYaw ?? (baseline?.yawDelta ? baseline.yawDelta * 55.0 : 0);
    const basePitch = baseline?.headPitch ?? (baseline?.vMouth ? (baseline.vMouth - 0.75) * 50.0 : 0);
    const baseIrisX = baseline?.irisX ?? 0.5;
    const baseIrisY = baseline?.irisY ?? 0.5;

    const effectiveYaw = rawPose.yaw - baseYaw;
    const effectivePitch = rawPose.pitch - basePitch;
    const effectiveIrisX = irisX - baseIrisX;
    const effectiveIrisY = irisY - baseIrisY;

    // Multimodal gaze fusion (head + eyes)
    const combinedYaw = effectiveYaw + effectiveIrisX * 45.0;
    const combinedPitch = effectivePitch + effectiveIrisY * 35.0;

    const metrics = {
      yaw: rawPose.yaw,
      pitch: rawPose.pitch,
      roll: rawPose.roll,
      irisX,
      irisY,
      ear: earAvg,
      combinedYaw,
      combinedPitch,
    };

    if (blinkConfirmed) {
      return { facing: true, state: "BLINKING", metrics, confidence: 0.9 };
    }

    if (Math.abs(rawPose.roll) > DEFAULT_PROCTOR_CONFIG.gaze.headRollThresholdDeg) {
      return {
        facing: false,
        state: "SUSPECTED_OFF_SCREEN",
        reason: "head_tilted",
        tip: "Head tilted — please face the screen directly",
        metrics,
        confidence: 0.9,
      };
    }

    if (Math.abs(combinedYaw) > DEFAULT_PROCTOR_CONFIG.gaze.headYawThresholdDeg || Math.abs(effectiveIrisX) > DEFAULT_PROCTOR_CONFIG.gaze.irisYawThreshold) {
      const reason = combinedYaw > 0 ? "looking_left" : "looking_right";
      return {
        facing: false,
        state: "SUSPECTED_OFF_SCREEN",
        reason,
        tip: "Head turned away — please face the screen",
        metrics,
        confidence: 0.92,
      };
    }

    if (combinedPitch > DEFAULT_PROCTOR_CONFIG.gaze.headPitchDownThresholdDeg || effectiveIrisY > DEFAULT_PROCTOR_CONFIG.gaze.irisPitchThreshold) {
      return {
        facing: false,
        state: "SUSPECTED_OFF_SCREEN",
        reason: "looking_down",
        tip: "Looking down — please face the screen",
        metrics,
        confidence: 0.92,
      };
    }

    if (combinedPitch < -DEFAULT_PROCTOR_CONFIG.gaze.headPitchUpThresholdDeg || effectiveIrisY < -DEFAULT_PROCTOR_CONFIG.gaze.irisPitchThreshold) {
      return {
        facing: false,
        state: "SUSPECTED_OFF_SCREEN",
        reason: "looking_up",
        tip: "Looking up — please face the screen",
        metrics,
        confidence: 0.88,
      };
    }

    return { facing: true, state: "NORMAL", metrics, confidence: 0.95 };
  }

  // BlazeFace 6 keypoints fallback
  const rEye = keypoints[0];
  const lEye = keypoints[1];
  const nose = keypoints[2];
  const mouth = keypoints[3];
  const rEar = keypoints[4];
  const lEar = keypoints[5];
  if (!rEye || !lEye || !nose || !mouth) return { facing: true };

  const dx = lEye.x - rEye.x;
  const dy = lEye.y - rEye.y;
  const dEyes = Math.hypot(dx, dy);
  if (dEyes < 0.01) return { facing: true }; // Degenerate / face too small

  const eyeMidX = (rEye.x + lEye.x) / 2;
  const eyeMidY = (rEye.y + lEye.y) / 2;

  // 1. Head tilt / roll
  const roll = Math.abs(dy) / dEyes;
  if (roll > 0.40) {
    return { facing: false, reason: "head_tilted", metrics: { yaw: 0, pitch: 0, roll } };
  }

  // 2. Horizontal yaw (turning head to left or right)
  const yawDelta = (nose.x - eyeMidX) / dEyes;
  const dR = Math.hypot(nose.x - rEye.x, nose.y - rEye.y);
  const dL = Math.hypot(nose.x - lEye.x, nose.y - lEye.y);
  const eyeRatio = Math.max(dR, dL) / Math.max(0.001, Math.min(dR, dL));

  // Ear-assisted 3D yaw if both ears are visible in frame
  let earYaw = false;
  if (rEar && lEar && typeof rEar.x === "number" && typeof lEar.x === "number") {
    const dREar = Math.hypot(rEar.x - eyeMidX, rEar.y - eyeMidY);
    const dLEar = Math.hypot(lEar.x - eyeMidX, lEar.y - eyeMidY);
    const earRatio = Math.max(dREar, dLEar) / Math.max(0.001, Math.min(dREar, dLEar));
    if (earRatio > 2.0) earYaw = true;
  }

  const baseYaw = baseline?.yawDelta ?? 0;
  const effectiveYaw = Math.abs(yawDelta - baseYaw);

  if (effectiveYaw > 0.30 || eyeRatio > 2.2 || earYaw) {
    return {
      facing: false,
      reason: yawDelta > 0 ? "looking_left" : "looking_right",
      metrics: { yaw: yawDelta, pitch: 0, roll },
    };
  }

  // 3. Vertical pitch (looking down at lap/notes vs looking up)
  const vNose = (nose.y - eyeMidY) / dEyes;
  const vMouth = (mouth.y - eyeMidY) / dEyes;
  const vNoseMouth = (mouth.y - nose.y) / dEyes;

  // Calibrated drop from baseline resting position
  const baseVMouth = baseline?.vMouth ?? 0.75;
  const pitchDrop = baseVMouth - vMouth;

  if (vMouth < 0.52 || pitchDrop > 0.22 || vNoseMouth < 0.18) {
    return {
      facing: false,
      reason: "looking_down",
      metrics: { yaw: yawDelta, pitch: vMouth, roll },
    };
  }
  if (vNose < 0.16) {
    return {
      facing: false,
      reason: "looking_up",
      metrics: { yaw: yawDelta, pitch: vMouth, roll },
    };
  }

  return { facing: true, metrics: { yaw: yawDelta, pitch: vMouth, roll } };
}

/**
 * Time between samples is credited up to this much and no further.
 *
 * Browsers throttle timers in a hidden tab to roughly once a minute. Crediting
 * that whole gap to "no face" would charge a student a minute of absence for a
 * minute the camera was not being looked at — and the tab-away is already
 * counted separately by the focus listeners.
 */
const MAX_CREDIT_MS = SAMPLE_INTERVAL_MS * 3;

/** One sample's worth of what the models reported. */
export interface CameraSample {
  /** Faces the face detector found above its confidence threshold. */
  faces: number;
  /** A phone was among the objects found. */
  phone: boolean;
  /** A book was among the objects found. */
  book: boolean;
  /**
   * The frame was too dark to read anything from — a hand or tape over the
   * lens. Measured from pixel brightness, not from a model.
   */
  covered: boolean;
  /**
   * The room is too dark to see the student (see isTooDark). Different from
   * `covered`: the lens is open, there is just not enough light.
   */
  dark?: boolean;
  /** Whether the face in view is looking away / not facing the screen. */
  lookingAway?: boolean;
  /** Whether speaking / talking / voice was heard during this sample interval. */
  voiceDetected?: boolean;
}

/** The kinds of moment worth one evidence photo. */
export type SnapshotKind = "phone" | "multiple_faces" | "no_face" | "book" | "looking_away" | "voice_detected" | "too_dark";

/** Counters reported with the attempt. Mirrors the camera fields on ProctorSignals. */
export interface CameraCounters {
  cameraSamples: number;
  noFaceMs: number;
  noFaceEvents: number;
  multiFaceEvents: number;
  phoneEvents: number;
  bookEvents: number;
  coveredMs: number;
  /** Time the room was too dark to see the student. */
  darkMs: number;
  lookingAwayEvents: number;
  lookingAwayMs: number;
  voiceEvents: number;
  voiceMs: number;
}

export const EMPTY_CAMERA_COUNTERS: CameraCounters = {
  cameraSamples: 0,
  noFaceMs: 0,
  noFaceEvents: 0,
  multiFaceEvents: 0,
  phoneEvents: 0,
  bookEvents: 0,
  coveredMs: 0,
  darkMs: 0,
  lookingAwayEvents: 0,
  lookingAwayMs: 0,
  voiceEvents: 0,
  voiceMs: 0,
};

interface Condition {
  hits: boolean[];
  active: boolean;
}

export interface TrackerState {
  counters: CameraCounters;
  noFace: Condition;
  multiFace: Condition;
  phone: Condition;
  book: Condition;
  covered: Condition;
  dark: Condition;
  lookingAway: Condition;
  voice: Condition;
  /**
   * How long nobody has been in frame without a break. Not a counter — it is
   * not reported — but what END_RULES reads: `noFaceMs` adds up every absence,
   * so three short glances down at rough work would eventually reach any
   * total, while a continuous minute away from the desk is a different thing.
   */
  noFaceRunMs: number;
  /** Continuous time looking away from the screen. */
  lookingAwayRunMs: number;
  /** Continuous time talking / voice detected. */
  voiceRunMs: number;
  /** Continuous time too dark to see the student. What TOO_DARK_END_MS is measured against. */
  darkRunMs: number;
}

const fresh = (): Condition => ({ hits: [], active: false });

export function createTracker(): TrackerState {
  return {
    counters: { ...EMPTY_CAMERA_COUNTERS },
    noFace: fresh(),
    multiFace: fresh(),
    phone: fresh(),
    book: fresh(),
    covered: fresh(),
    dark: fresh(),
    lookingAway: fresh(),
    voice: fresh(),
    noFaceRunMs: 0,
    lookingAwayRunMs: 0,
    voiceRunMs: 0,
    darkRunMs: 0,
  };
}

/** Pushes one sample into a condition. Returns the new condition and whether it just switched on. */
function step(
  c: Condition,
  hit: boolean,
  activateAt = ACTIVATE_AT,
  { window = WINDOW, releaseAt = RELEASE_AT }: { window?: number; releaseAt?: number } = {},
): { next: Condition; rose: boolean } {
  const hits = [...c.hits, hit].slice(-window);
  const count = hits.filter(Boolean).length;

  let active = c.active;
  if (!active && count >= activateAt) active = true;
  else if (active && count <= releaseAt) active = false;

  return { next: { hits, active }, rose: active && !c.active };
}

export interface Observation {
  state: TrackerState;
  /** Conditions that switched on with this sample — the moments worth a photo. */
  started: SnapshotKind[];
}

/**
 * Folds one sample into the tracker.
 *
 * `elapsedMs` is the real time since the previous sample, so durations stay
 * honest when the browser delivers samples late.
 */
export function observe(
  state: TrackerState,
  sample: CameraSample,
  elapsedMs: number,
): Observation {
  /**
   * Rounded, and this is load-bearing. Elapsed time comes from
   * performance.now(), which is fractional, and the wire schema requires
   * integers — and it is nested inside every submit route's body schema, so one
   * fractional millisecond would reject the whole submission with a 400.
   */
  const credit = Math.round(Math.max(0, Math.min(elapsedMs, MAX_CREDIT_MS)));

  /**
   * A covered lens is its own finding and suppresses the others. Behind a hand
   * the face detector finds nobody, and counting that as "nobody at the desk"
   * as well would report one act twice under two names.
   */
  const covered = step(state.covered, sample.covered, COVERED_ACTIVATE_AT);
  /**
   * Darkness, like a covered lens, suppresses what depends on seeing: in a
   * dark room nobody can be found, and that is one finding, not "nobody at
   * the desk" as well. A covered lens is the more specific of the two.
   */
  const darkNow = !sample.covered && Boolean(sample.dark);
  const dark = step(state.dark, darkNow, COVERED_ACTIVATE_AT);
  const seeing = !sample.covered && !darkNow;

  const noFace = step(state.noFace, seeing && sample.faces === 0);
  const multiFace = step(state.multiFace, seeing && sample.faces >= 2);
  const phone = step(state.phone, seeing && sample.phone, PHONE_ACTIVATE_AT);
  const book = step(state.book, seeing && sample.book);
  const confirmed = { window: CONFIRMED_WINDOW, releaseAt: CONFIRMED_RELEASE_AT };
  const lookingAway = step(state.lookingAway, seeing && Boolean(sample.lookingAway), CONFIRMED_ACTIVATE_AT, confirmed);
  const voice = step(state.voice, Boolean(sample.voiceDetected), CONFIRMED_ACTIVATE_AT, confirmed);

  let newLookingAwayRunMs = lookingAway.next.active ? state.lookingAwayRunMs + credit : 0;
  let extraLookingAwayEvents = 0;
  if (newLookingAwayRunMs >= 15_000) {
    extraLookingAwayEvents = Math.floor(newLookingAwayRunMs / 15_000);
    newLookingAwayRunMs = newLookingAwayRunMs % 15_000;
  }

  let newVoiceRunMs = voice.next.active ? state.voiceRunMs + credit : 0;
  let extraVoiceEvents = 0;
  if (newVoiceRunMs >= 15_000) {
    extraVoiceEvents = Math.floor(newVoiceRunMs / 15_000);
    newVoiceRunMs = newVoiceRunMs % 15_000;
  }

  const c = state.counters;
  const counters: CameraCounters = {
    cameraSamples: c.cameraSamples + 1,
    noFaceMs: c.noFaceMs + (noFace.next.active ? credit : 0),
    noFaceEvents: c.noFaceEvents + (noFace.rose ? 1 : 0),
    multiFaceEvents: c.multiFaceEvents + (multiFace.rose ? 1 : 0),
    phoneEvents: c.phoneEvents + (phone.rose ? 1 : 0),
    bookEvents: c.bookEvents + (book.rose ? 1 : 0),
    coveredMs: c.coveredMs + (covered.next.active ? credit : 0),
    darkMs: c.darkMs + (dark.next.active ? credit : 0),
    lookingAwayMs: c.lookingAwayMs + (lookingAway.next.active ? credit : 0),
    lookingAwayEvents: c.lookingAwayEvents + (lookingAway.rose ? 1 : 0) + extraLookingAwayEvents,
    voiceMs: c.voiceMs + (voice.next.active ? credit : 0),
    voiceEvents: c.voiceEvents + (voice.rose ? 1 : 0) + extraVoiceEvents,
  };

  const started: SnapshotKind[] = [];
  if (phone.rose) started.push("phone");
  if (multiFace.rose) started.push("multiple_faces");
  if (noFace.rose) started.push("no_face");
  if (book.rose) started.push("book");
  if (lookingAway.rose) started.push("looking_away");
  if (voice.rose) started.push("voice_detected");
  if (dark.rose) started.push("too_dark");

  return {
    state: {
      counters,
      noFace: noFace.next,
      multiFace: multiFace.next,
      phone: phone.next,
      book: book.next,
      covered: covered.next,
      dark: dark.next,
      lookingAway: lookingAway.next,
      voice: voice.next,
      noFaceRunMs: noFace.next.active ? state.noFaceRunMs + credit : 0,
      lookingAwayRunMs: newLookingAwayRunMs,
      voiceRunMs: newVoiceRunMs,
      // Measured from the first dark sample, not from when the condition
      // switched on, so the countdown the student sees is the real one.
      darkRunMs: darkNow ? state.darkRunMs + credit : 0,
    },
    started,
  };
}

/**
 * Why an attempt was ended. Stored with the lock and shown to the student, the
 * teacher and the admin.
 *
 * All but the last come from the camera. `tab_switch` is the page's own focus
 * check in src/hooks/use-proctor.ts; it lives here so there is one list of
 * reasons, one set of labels, and one constraint in the database to match.
 */
export type EndReason =
  | "phone"
  | "multiple_faces"
  | "camera_covered"
  | "no_face"
  | "camera_off"
  | "tab_switch"
  | "looking_away"
  | "voice_detected"
  | "too_dark";

export const END_REASONS: readonly EndReason[] = [
  "phone",
  "multiple_faces",
  "camera_covered",
  "no_face",
  "camera_off",
  "tab_switch",
  "looking_away",
  "voice_detected",
  "too_dark",
];

/** Said to the student on the ended screen, and to whoever reviews it. */
export const END_REASON_LABEL: Record<EndReason, string> = {
  phone: "A phone was seen on camera",
  multiple_faces: "Another person was seen on camera",
  camera_covered: "The camera was covered",
  no_face: "You were away from the camera for over a minute",
  camera_off: "The camera was switched off",
  tab_switch: "You left the test window",
  looking_away: "You looked away from the screen too many times",
  voice_detected: "Speaking or voice was detected during the test",
  too_dark: "The room was too dark to see you",
};

/** Continuous time out of frame that ends an attempt. */
export const NO_FACE_END_MS = 60_000;

/**
 * Whether what the camera is seeing now ends the attempt.
 *
 * It reads the debounced conditions, never a raw frame: a phone has to be
 * seen for about 3 seconds of the last 7.5 before this fires, the same bar
 * that makes it an event at all. One misread frame cannot end anyone's test.
 *
 * A book is not on the list. Rough work on paper is normal for case
 * arithmetic, and the object model cannot tell a notebook from a textbook.
 * Absence needs a continuous minute, not a few seconds: a student looking
 * down at their own notes drops out of the face detector's view, and ending
 * the test for that would end most tests.
 */
export function endReason(state: TrackerState): EndReason | null {
  if (state.phone.active) return "phone";
  if (state.multiFace.active) return "multiple_faces";
  if (state.covered.active) return "camera_covered";
  if (state.darkRunMs >= TOO_DARK_END_MS) return "too_dark";
  if (state.noFaceRunMs >= NO_FACE_END_MS) return "no_face";
  // `>=`: the student is shown "5/5" and "3/3", and that is when it ends.
  if (state.counters.lookingAwayEvents >= MAX_LOOKING_AWAY_STRIKES) return "looking_away";
  if (state.counters.voiceEvents >= MAX_VOICE_STRIKES) return "voice_detected";
  return null;
}

/** Average brightness (Rec. 601 luma, 0–255) of an RGBA frame. */
export function frameBrightness(rgba: ArrayLike<number>): number {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    sum += 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  }
  return sum / pixels;
}

/**
 * Whether the room is too dark to see the student: very dark outright, or
 * dim with nobody the face detector can find. A dim room where the face is
 * still found is not too dark — the student can be seen, which is the point.
 */
export function isTooDark(brightness: number, faces: number): boolean {
  if (brightness < DARK_MEAN) return true;
  return faces === 0 && brightness < DIM_MEAN;
}

/**
 * Decides from raw RGBA pixels whether the lens is covered or blocked.
 *
 * Takes a tiny frame — the hook scales the video down to 32×24 first — so this
 * costs a few hundred additions, not a pass over a full HD frame.
 *
 * Detects:
 * - Pitch-dark or shadowed lens (shutter closed, dark tape, dark room): low brightness + low spread.
 * - Hands, fingers, skin pressed against lens: illuminated by the screen/ambient light,
 *   producing a blurry, flat field with very low spread and near-zero neighbor gradient.
 * - Tape, stickers, paper, post-it notes, cloth, cards: flat color/brightness field
 *   with almost zero spread across the frame.
 * - Overexposed / blinded lens (flashlight, white tape right against sensor).
 */
export function isCovered(rgba: ArrayLike<number>): boolean {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels < 16) return false;

  let sum = 0;
  let sumSq = 0;
  let diffSum = 0;
  let diffCount = 0;
  const width = 32;
  const height = 24;

  const luma = new Float32Array(pixels);
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    // Rec. 601 luma — what the eye reads as brightness.
    const y = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
    luma[i] = y;
    sum += y;
    sumSq += y * y;
  }

  const mean = sum / pixels;
  const spread = Math.sqrt(Math.max(0, sumSq / pixels - mean * mean));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (idx >= pixels) break;
      const y0 = luma[idx];
      if (x + 1 < width && idx + 1 < pixels) {
        diffSum += Math.abs(luma[idx + 1] - y0);
        diffCount++;
      }
      if (y + 1 < height && idx + width < pixels) {
        diffSum += Math.abs(luma[idx + width] - y0);
        diffCount++;
      }
    }
  }
  const grad = diffCount > 0 ? diffSum / diffCount : 0;

  // 1. Dark (shutter, black tape, dark room) — must be flat (not a face lit by screen in a dark room)
  if (mean < 35 && spread < 12) return true;

  // 2. Extremely flat (paper, tape, post-it, finger/hand pressed directly over lens)
  if (spread < 8.0 && grad < 3.0) return true;

  // 3. Low spread with low gradient
  if (spread < 10.0 && grad < 2.0) return true;

  // 4. Overexposed / blinded (whiteout / flashlight against sensor)
  if (mean > 240 && spread < 10.0) return true;

  return false;
}

/**
 * Checks whether the camera is blocked or obstructed when the face detector
 * already confirmed that 0 faces are in view.
 *
 * Catches looser obstruction (e.g. an object or palm held a few inches in front
 * of the camera to hide from the detector).
 */
export function isBlockedWithoutFace(rgba: ArrayLike<number>): boolean {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels < 16) return false;

  let sum = 0;
  let sumSq = 0;
  let diffSum = 0;
  let diffCount = 0;
  const width = 32;
  const height = 24;

  const luma = new Float32Array(pixels);
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    const y = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
    luma[i] = y;
    sum += y;
    sumSq += y * y;
  }

  const mean = sum / pixels;
  const spread = Math.sqrt(Math.max(0, sumSq / pixels - mean * mean));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (idx >= pixels) break;
      const y0 = luma[idx];
      if (x + 1 < width && idx + 1 < pixels) {
        diffSum += Math.abs(luma[idx + 1] - y0);
        diffCount++;
      }
      if (y + 1 < height && idx + width < pixels) {
        diffSum += Math.abs(luma[idx + width] - y0);
        diffCount++;
      }
    }
  }
  const grad = diffCount > 0 ? diffSum / diffCount : 0;

  return (spread < 13.0 && grad < 3.5) || (mean < 45 && spread < 15.0);
}
