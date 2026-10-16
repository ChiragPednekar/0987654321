/**
 * Advanced Facial & Eye-Gaze Tracking Engine
 *
 * Implements:
 * 1. 478 MediaPipe 3D face mesh + iris landmarks extraction (with BlazeFace fallback)
 * 2. True blink detection via Eye Aspect Ratio (EAR) and eyelid blendshapes
 * 3. Normalized iris gaze estimation within eye geometry
 * 4. 3D Head Pose estimation (yaw, pitch, roll in degrees)
 * 5. Multimodal Gaze Fusion (head orientation + iris displacement)
 * 6. Natural resting posture calibration baseline
 * 7. Temporal Exponential Moving Average (EMA) smoothing and hysteresis state management
 */

import { DEFAULT_PROCTOR_CONFIG, type GazeTrackingConfig } from "@/lib/proctor-config";

export type GazeDetectionState =
  | "NORMAL"
  | "SUSPECTED_OFF_SCREEN"
  | "OFF_SCREEN_CONFIRMED"
  | "TRACKING_UNCERTAIN"
  | "FACE_NOT_VISIBLE"
  | "BLINKING";

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface HeadPoseEuler {
  yaw: number; // Positive = turned left (subject's right), Negative = turned right
  pitch: number; // Positive = looking down, Negative = looking up
  roll: number; // Head tilt sideways
}

export interface EyeLandmarkMetrics {
  earLeft: number;
  earRight: number;
  earAvg: number;
  blinking: boolean;
  irisRatioX: number; // 0.5 = center, >0.5 = looking left, <0.5 = looking right
  irisRatioY: number; // 0.5 = center, >0.5 = looking down, <0.5 = looking up
}

export interface GazeMetrics {
  yaw: number; // degrees
  pitch: number; // degrees
  roll: number; // degrees
  irisX: number; // normalized
  irisY: number; // normalized
  ear: number; // Eye Aspect Ratio
  combinedYaw: number; // degrees (head + eyes)
  combinedPitch: number; // degrees (head + eyes)
  confidence: number; // 0.0 - 1.0
}

export interface GazeAnalysisResult {
  state: GazeDetectionState;
  facing: boolean;
  confidence: number;
  reason?: "looking_left" | "looking_right" | "looking_down" | "looking_up" | "head_tilted" | "face_not_visible" | "tracking_uncertain";
  tip?: string;
  metrics: GazeMetrics;
}

export interface GazeBaseline {
  headYaw: number;
  headPitch: number;
  headRoll: number;
  irisX: number;
  irisY: number;
  vMouth?: number;
  yawDelta?: number;
}

/** MediaPipe canonical landmark indices for eyes and iris. */
export const MESH_INDICES = {
  // Right eye (subject's right / viewer's left)
  rightEye: {
    outer: 33,
    inner: 133,
    top: 159,
    topAlt1: 158,
    topAlt2: 160,
    bottom: 145,
    bottomAlt1: 144,
    bottomAlt2: 153,
    irisCenter: 468,
  },
  // Left eye (subject's left / viewer's right)
  leftEye: {
    outer: 263,
    inner: 362,
    top: 386,
    topAlt1: 385,
    topAlt2: 387,
    bottom: 374,
    bottomAlt1: 373,
    bottomAlt2: 380,
    irisCenter: 473,
  },
  noseTip: 1,
  chin: 152,
  forehead: 10,
  leftMouth: 61,
  rightMouth: 291,
};

function dist(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/**
 * Computes Eye Aspect Ratio (EAR) for blink detection.
 * EAR = (|p2 - p6| + |p3 - p5|) / (2 * |p1 - p4|)
 */
export function calculateEyeAspectRatio(
  landmarks: NormalizedLandmark[],
  isRightEye: boolean,
): number {
  const idx = isRightEye ? MESH_INDICES.rightEye : MESH_INDICES.leftEye;
  const p1 = landmarks[idx.outer];
  const p4 = landmarks[idx.inner];
  const p2 = landmarks[idx.topAlt2];
  const p6 = landmarks[idx.bottomAlt2];
  const p3 = landmarks[idx.topAlt1];
  const p5 = landmarks[idx.bottomAlt1];

  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.25;

  const horizontal = dist(p1, p4);
  if (horizontal < 1e-4) return 0.25;

  const vertical1 = dist(p2, p6);
  const vertical2 = dist(p3, p5);

  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Extracts normalized horizontal and vertical iris position within eye opening.
 */
/**
 * Eyelid opening, as a fraction of eye width, below which the vertical iris
 * position is not trusted. A concentrating or squinting student narrows the
 * eye to a few pixels; dividing the iris offset by that sliver turns a
 * sub-pixel jitter into a swing across the whole 0–1 range — a phantom 17°
 * glance. Below this, the vertical reading is held instead of read. An open
 * eye measures about 0.3–0.4; the blink threshold sits at 0.18.
 */
export const SQUINT_APERTURE = 0.25;

export function extractIrisGazeRatio(
  landmarks: NormalizedLandmark[],
): { irisX: number; irisY: number; earAvg: number; blinking: boolean; irisYReliable: boolean } {
  const earRight = calculateEyeAspectRatio(landmarks, true);
  const earLeft = calculateEyeAspectRatio(landmarks, false);
  const earAvg = (earRight + earLeft) / 2.0;

  const rIdx = MESH_INDICES.rightEye;
  const lIdx = MESH_INDICES.leftEye;

  const rOuter = landmarks[rIdx.outer];
  const rInner = landmarks[rIdx.inner];
  const rTop = landmarks[rIdx.top];
  const rBottom = landmarks[rIdx.bottom];
  const rIris = landmarks[rIdx.irisCenter];

  const lOuter = landmarks[lIdx.outer];
  const lInner = landmarks[lIdx.inner];
  const lTop = landmarks[lIdx.top];
  const lBottom = landmarks[lIdx.bottom];
  const lIris = landmarks[lIdx.irisCenter];

  const blinking = earAvg < DEFAULT_PROCTOR_CONFIG.gaze.blinkEarThreshold;

  if (!rOuter || !rInner || !rIris || !lOuter || !lInner || !lIris) {
    return { irisX: 0.5, irisY: 0.5, earAvg, blinking, irisYReliable: false };
  }

  // Right eye horizontal ratio (outer = 0, inner = 1)
  const rWidth = rInner.x - rOuter.x;
  const rRatioX = Math.abs(rWidth) > 1e-4 ? (rIris.x - rOuter.x) / rWidth : 0.5;

  // Left eye horizontal ratio (inner = 0, outer = 1)
  const lWidth = lOuter.x - lInner.x;
  const lRatioX = Math.abs(lWidth) > 1e-4 ? (lIris.x - lInner.x) / lWidth : 0.5;

  // Combined horizontal ratio: average of both eyes
  const irisX = Math.max(0, Math.min(1, (rRatioX + lRatioX) / 2.0));

  // Vertical ratio, per eye, only where the eye is open enough to read it.
  const verticalRatio = (
    iris: NormalizedLandmark,
    top: NormalizedLandmark | undefined,
    bottom: NormalizedLandmark | undefined,
    width: number,
  ): number | null => {
    if (!top || !bottom) return null;
    const height = bottom.y - top.y;
    if (Math.abs(width) < 1e-4 || height < SQUINT_APERTURE * Math.abs(width)) return null;
    return (iris.y - top.y) / height;
  };
  const ys = [
    verticalRatio(rIris, rTop, rBottom, rWidth),
    verticalRatio(lIris, lTop, lBottom, lWidth),
  ].filter((v): v is number => v !== null);

  const irisYReliable = ys.length > 0 && !blinking;
  const irisY = irisYReliable
    ? Math.max(0, Math.min(1, ys.reduce((a, b) => a + b, 0) / ys.length))
    : 0.5;

  return { irisX, irisY, earAvg, blinking, irisYReliable };
}

/**
 * Calculates 3D head pose (yaw, pitch, roll) from 4x4 transformation matrix or landmarks.
 */
export function extractHeadPose(
  landmarks: NormalizedLandmark[],
  transformationMatrix?: number[] | null,
): HeadPoseEuler {
  // If MediaPipe 4x4 transformation matrix is available (column-major)
  if (transformationMatrix && transformationMatrix.length >= 16) {
    const m = transformationMatrix;
    // Rotation matrix elements:
    // m[0]=r00, m[1]=r10, m[2]=r20
    // m[4]=r01, m[5]=r11, m[6]=r21
    // m[8]=r02, m[9]=r12, m[10]=r22
    const yaw = Math.atan2(m[2], m[10]) * (180.0 / Math.PI);
    const pitch = Math.asin(Math.max(-1.0, Math.min(1.0, -m[6]))) * (180.0 / Math.PI);
    const roll = Math.atan2(m[4], m[5]) * (180.0 / Math.PI);
    return { yaw, pitch, roll };
  }

  // Fallback: estimate from landmarks geometry
  const nose = landmarks[MESH_INDICES.noseTip] ?? landmarks[2];
  const rEye = landmarks[MESH_INDICES.rightEye.outer] ?? landmarks[0];
  const lEye = landmarks[MESH_INDICES.leftEye.outer] ?? landmarks[1];
  const chin = landmarks[MESH_INDICES.chin] ?? landmarks[3];

  if (!nose || !rEye || !lEye) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  const eyeMidX = (rEye.x + lEye.x) / 2.0;
  const eyeMidY = (rEye.y + lEye.y) / 2.0;
  const eyeDist = Math.hypot(lEye.x - rEye.x, lEye.y - rEye.y);

  if (eyeDist < 1e-4) return { yaw: 0, pitch: 0, roll: 0 };

  // Yaw: horizontal displacement of nose relative to eye midpoint
  const yaw = ((nose.x - eyeMidX) / eyeDist) * 55.0;

  // Roll: angle of eye line relative to horizontal
  const roll = (Math.atan2(lEye.y - rEye.y, lEye.x - rEye.x) * 180.0) / Math.PI;

  // Pitch: vertical displacement of nose/chin relative to eyes
  let pitch = 0;
  if (chin) {
    const faceHeight = Math.hypot(chin.x - eyeMidX, chin.y - eyeMidY);
    const expectedNoseY = eyeMidY + faceHeight * 0.42;
    pitch = ((nose.y - expectedNoseY) / eyeDist) * 50.0;
  } else {
    pitch = ((nose.y - eyeMidY) / eyeDist - 0.38) * 50.0;
  }

  return { yaw, pitch, roll };
}

/**
 * The one off-screen timer. A glance only becomes "looking away" once the
 * gaze has stayed off the screen for `minOffScreenDwellMs`; looking back
 * drains the timer at 1.5× speed, so flicking back for a moment does not reset
 * a sustained look away, and a single missed frame does not end one either.
 *
 * Exported so the BlazeFace fallback path (no face mesh) is judged by the
 * same clock rather than by a second, competing debounce.
 */
export class OffScreenDwell {
  private dwellMs = 0;
  constructor(private readonly minDwellMs = DEFAULT_PROCTOR_CONFIG.gaze.minOffScreenDwellMs) {}

  reset() {
    this.dwellMs = 0;
  }

  /** Feeds one frame; returns whether the gaze is CONFIRMED off-screen. */
  update(offScreen: boolean, elapsedMs: number, hold = false): { confirmed: boolean; suspected: boolean } {
    if (hold) {
      // A blink: neither evidence for nor against.
    } else if (offScreen) {
      this.dwellMs += elapsedMs;
    } else {
      this.dwellMs = Math.max(0, this.dwellMs - elapsedMs * 1.5);
    }
    return { confirmed: this.dwellMs >= this.minDwellMs, suspected: this.dwellMs > 0 };
  }
}

/** Downward head pitch (degrees) still treated as a resting laptop posture. */
export const LAPTOP_MAX_REST_PITCH = 22;

export class TemporalGazeTracker {
  private config: GazeTrackingConfig;
  private baseline: GazeBaseline | null = null;
  private baselineBuffer: Array<{ yaw: number; pitch: number; roll: number; irisX: number; irisY: number }> = [];
  private rawCalibration: Array<{ pitch: number; yaw: number }> = [];

  private smoothedYaw = 0;
  private smoothedPitch = 0;
  private smoothedRoll = 0;
  private smoothedIrisX = 0.5;
  private smoothedIrisY = 0.5;

  private dwell: OffScreenDwell;
  private currentState: GazeDetectionState = "NORMAL";
  private hasHistory = false;

  constructor(config: GazeTrackingConfig = DEFAULT_PROCTOR_CONFIG.gaze) {
    this.config = config;
    this.dwell = new OffScreenDwell(config.minOffScreenDwellMs);
  }

  public setBaseline(baseline: GazeBaseline | null) {
    this.baseline = baseline;
  }

  public getBaseline(): GazeBaseline | null {
    return this.baseline;
  }

  public reset() {
    this.baseline = null;
    this.baselineBuffer = [];
    this.rawCalibration = [];
    this.smoothedYaw = 0;
    this.smoothedPitch = 0;
    this.smoothedRoll = 0;
    this.smoothedIrisX = 0.5;
    this.smoothedIrisY = 0.5;
    this.dwell.reset();
    this.currentState = "NORMAL";
    this.hasHistory = false;
  }

  /**
   * Evaluates a frame with facial landmarks, head pose, and iris metrics.
   */
  public processFrame(
    landmarks: NormalizedLandmark[] | null | undefined,
    elapsedMs: number,
    transformationMatrix?: number[] | null,
    blendshapes?: Array<{ categoryName: string; score: number }> | null,
  ): GazeAnalysisResult {
    if (!landmarks || landmarks.length < 4) {
      // A face that drops out of the mesh for a moment — a hand to the chin,
      // a turn of the head to reach for water — is judged on the same clock
      // as any other look away. Only a sustained absence counts.
      const { confirmed } = this.dwell.update(true, elapsedMs);
      this.currentState = confirmed ? "OFF_SCREEN_CONFIRMED" : "FACE_NOT_VISIBLE";
      return {
        state: this.currentState,
        facing: !confirmed,
        confidence: 0,
        reason: "face_not_visible",
        tip: "Face not visible — please stay centered in front of the camera",
        metrics: {
          yaw: 0,
          pitch: 0,
          roll: 0,
          irisX: 0.5,
          irisY: 0.5,
          ear: 0,
          combinedYaw: 0,
          combinedPitch: 0,
          confidence: 0,
        },
      };
    }

    // 1. Extract Head Pose
    const rawPose = extractHeadPose(landmarks, transformationMatrix);

    // 2. Extract Iris & Blink status
    const {
      earAvg,
      irisX: rawIrisX,
      irisY: rawIrisY,
      blinking: rawBlinking,
      irisYReliable,
    } = extractIrisGazeRatio(landmarks);
    let irisX = rawIrisX;
    let irisY = rawIrisY;
    let blinking = rawBlinking;

    // Check blendshapes if available for extra blink confirmation
    if (blendshapes && blendshapes.length > 0) {
      const blinkLeft = blendshapes.find((b) => b.categoryName === "eyeBlinkLeft")?.score ?? 0;
      const blinkRight = blendshapes.find((b) => b.categoryName === "eyeBlinkRight")?.score ?? 0;
      if (blinkLeft > this.config.blinkBlendshapeThreshold || blinkRight > this.config.blinkBlendshapeThreshold) {
        blinking = true;
      }
    }

    // If blinking, suppress instantaneous gaze deviation and preserve smoothed iris
    if (blinking) {
      irisX = this.smoothedIrisX;
      irisY = this.smoothedIrisY;
    } else if (!irisYReliable) {
      // Squinting: the horizontal reading is still good, the vertical is not.
      irisY = this.hasHistory ? this.smoothedIrisY : 0.5;
    }

    // 3. Temporal Smoothing (EMA) with warm start
    const alpha = this.config.gazeSmoothingFactor;
    if (!this.hasHistory) {
      this.smoothedYaw = rawPose.yaw;
      this.smoothedPitch = rawPose.pitch;
      this.smoothedRoll = rawPose.roll;
      this.smoothedIrisX = irisX;
      this.smoothedIrisY = irisY;
      this.hasHistory = true;
    } else {
      this.smoothedYaw = this.smoothedYaw * (1 - alpha) + rawPose.yaw * alpha;
      this.smoothedPitch = this.smoothedPitch * (1 - alpha) + rawPose.pitch * alpha;
      this.smoothedRoll = this.smoothedRoll * (1 - alpha) + rawPose.roll * alpha;
      this.smoothedIrisX = this.smoothedIrisX * (1 - alpha) + irisX * alpha;
      this.smoothedIrisY = this.smoothedIrisY * (1 - alpha) + irisY * alpha;
    }

    // 4. Baseline Calibration during initial frontal samples
    if (!this.baseline) {
      /**
       * A laptop webcam sits above the screen, so a student reading it looks
       * 12–22° DOWN relative to the camera. Requiring |pitch| < 10° meant most
       * laptop users never calibrated, and the uncalibrated threshold then
       * called their ordinary reading posture "looking down" all test long.
       * Up to LAPTOP_MAX_REST_PITCH down is accepted — but only while the head
       * is steady, so a student glancing around cannot calibrate on a glance.
       */
      const resting =
        Math.abs(this.smoothedYaw) < 10.0 &&
        this.smoothedPitch > -10.0 &&
        this.smoothedPitch < LAPTOP_MAX_REST_PITCH &&
        Math.abs(this.smoothedRoll) < 12.0 &&
        !blinking;
      // Steadiness is judged on the RAW pose against the frames collected so
      // far. The smoothed pose hides a wobbling head — an EMA turns ±8°
      // swings into ±3° — so it cannot tell resting from glancing around.
      const n = this.rawCalibration.length;
      const meanRawPitch = n ? this.rawCalibration.reduce((a, b) => a + b.pitch, 0) / n : rawPose.pitch;
      const meanRawYaw = n ? this.rawCalibration.reduce((a, b) => a + b.yaw, 0) / n : rawPose.yaw;
      const steady =
        Math.abs(rawPose.pitch - meanRawPitch) < 5.0 && Math.abs(rawPose.yaw - meanRawYaw) < 6.0;
      if (!steady) {
        this.baselineBuffer = [];
        this.rawCalibration = [];
      }
      const isFrontal = resting;

      if (isFrontal) {
        this.rawCalibration.push({ pitch: rawPose.pitch, yaw: rawPose.yaw });
        this.baselineBuffer.push({
          yaw: this.smoothedYaw,
          pitch: this.smoothedPitch,
          roll: this.smoothedRoll,
          irisX: this.smoothedIrisX,
          irisY: this.smoothedIrisY,
        });

        if (this.baselineBuffer.length >= this.config.calibrationFrames) {
          const count = this.baselineBuffer.length;
          const avgYaw = this.baselineBuffer.reduce((a, b) => a + b.yaw, 0) / count;
          const avgPitch = this.baselineBuffer.reduce((a, b) => a + b.pitch, 0) / count;
          const avgRoll = this.baselineBuffer.reduce((a, b) => a + b.roll, 0) / count;
          const avgIrisX = this.baselineBuffer.reduce((a, b) => a + b.irisX, 0) / count;
          const avgIrisY = this.baselineBuffer.reduce((a, b) => a + b.irisY, 0) / count;
          this.baseline = {
            headYaw: avgYaw,
            headPitch: avgPitch,
            headRoll: avgRoll,
            irisX: avgIrisX,
            irisY: avgIrisY,
          };
        }
      }
    }

    // Baseline offsets
    const baseYaw = this.baseline?.headYaw ?? 0;
    const basePitch = this.baseline?.headPitch ?? 0;
    const baseIrisX = this.baseline?.irisX ?? 0.5;
    const baseIrisY = this.baseline?.irisY ?? 0.5;

    // 5. Multimodal Gaze Fusion
    // Eye movement adds roughly ±30 degrees of visual field
    const effectiveYaw = this.smoothedYaw - baseYaw;
    const effectivePitch = this.smoothedPitch - basePitch;
    const effectiveIrisX = this.smoothedIrisX - baseIrisX;
    const effectiveIrisY = this.smoothedIrisY - baseIrisY;

    const combinedYaw = effectiveYaw + effectiveIrisX * 45.0;
    const combinedPitch = effectivePitch + effectiveIrisY * 35.0;

    // 6. Classification & Reason Determination
    let instantaneousOffScreen = false;
    let reason: GazeAnalysisResult["reason"];
    let tip: string | undefined;

    // Head roll (tilt) check
    if (Math.abs(this.smoothedRoll) > this.config.headRollThresholdDeg) {
      instantaneousOffScreen = true;
      reason = "head_tilted";
      tip = "Head tilted — please face the screen directly";
    }
    // Horizontal off-screen (looking left / right)
    else if (Math.abs(combinedYaw) > this.config.headYawThresholdDeg || Math.abs(effectiveIrisX) > this.config.irisYawThreshold) {
      instantaneousOffScreen = true;
      reason = combinedYaw > 0 ? "looking_left" : "looking_right";
      tip = "Head turned away — please face the screen";
    }
    // Vertical off-screen (looking down at lap / notes). Until the resting
    // posture is calibrated, a laptop camera sees everyone reading at up to
    // LAPTOP_MAX_REST_PITCH down, so that much is allowed on top of the usual
    // threshold — and the iris, which also sits low when reading a laptop
    // screen, is not judged vertically. This is NOT "no judgement": a student
    // who looks down at notes from the very first second never calibrates,
    // and must still be caught.
    else if (
      combinedPitch - (this.baseline ? 0 : LAPTOP_MAX_REST_PITCH) > this.config.headPitchDownThresholdDeg ||
      (this.baseline !== null && effectiveIrisY > this.config.irisPitchThreshold)
    ) {
      instantaneousOffScreen = true;
      reason = "looking_down";
      tip = "Looking down — please face the screen";
    }
    // Vertical off-screen (looking up). Up is not skewed by the camera, so
    // the head is judged from the start; the iris waits for calibration.
    else if (
      combinedPitch < -this.config.headPitchUpThresholdDeg ||
      (this.baseline !== null && effectiveIrisY < -this.config.irisPitchThreshold)
    ) {
      instantaneousOffScreen = true;
      reason = "looking_up";
      tip = "Looking up — please face the screen";
    }

    // 7. One dwell timer decides. A glance is SUSPECTED until it has lasted
    //    minOffScreenDwellMs; only then is it CONFIRMED, and only CONFIRMED
    //    counts as not facing. Blinks hold the timer where it is.
    const { confirmed, suspected } = this.dwell.update(instantaneousOffScreen, elapsedMs, blinking);
    if (confirmed) this.currentState = "OFF_SCREEN_CONFIRMED";
    else if (blinking) this.currentState = "BLINKING";
    else if (suspected && instantaneousOffScreen) this.currentState = "SUSPECTED_OFF_SCREEN";
    else this.currentState = "NORMAL";

    // Confidence estimation
    const faceScale = dist(landmarks[0] ?? landmarks[MESH_INDICES.noseTip], landmarks[1] ?? landmarks[MESH_INDICES.chin]);
    const confidence = Math.max(0.4, Math.min(0.98, faceScale > 0.05 ? 0.92 : 0.65));

    // Facing unless the dwell CONFIRMED the look away. A suspected glance is
    // shown to the student as a tip, never counted (see camera-proctor.ts).
    const facing = this.currentState !== "OFF_SCREEN_CONFIRMED";

    return {
      state: this.currentState,
      facing,
      confidence,
      reason,
      tip,
      metrics: {
        yaw: this.smoothedYaw,
        pitch: this.smoothedPitch,
        roll: this.smoothedRoll,
        irisX: this.smoothedIrisX,
        irisY: this.smoothedIrisY,
        ear: earAvg,
        combinedYaw,
        combinedPitch,
        confidence,
      },
    };
  }
}
