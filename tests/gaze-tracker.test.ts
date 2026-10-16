import { describe, expect, it } from "vitest";
import {
  extractIrisGazeRatio,
  LAPTOP_MAX_REST_PITCH,
  OffScreenDwell,
  TemporalGazeTracker,
  type NormalizedLandmark,
} from "@/lib/gaze-tracker";
import { DEFAULT_PROCTOR_CONFIG } from "@/lib/proctor-config";

const FRAME_MS = 750;
const DWELL = DEFAULT_PROCTOR_CONFIG.gaze.minOffScreenDwellMs;

/**
 * A face mesh with two eyes. `aperture` is eyelid height as a fraction of eye
 * width (open ≈ 0.35); `irisY` is where the iris sits between the lids (0.5 =
 * centre).
 */
function face({ aperture = 0.35, irisY = 0.5 }: { aperture?: number; irisY?: number } = {}) {
  const lm: NormalizedLandmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const eye = (outer: number, inner: number, xOuter: number, xInner: number, ids: Record<string, number>) => {
    const width = Math.abs(xInner - xOuter);
    const height = width * aperture;
    const cx = (xOuter + xInner) / 2;
    const top = 0.4 - height / 2;
    const bottom = 0.4 + height / 2;
    lm[outer] = { x: xOuter, y: 0.4 };
    lm[inner] = { x: xInner, y: 0.4 };
    for (const k of ["top", "topAlt1", "topAlt2"]) lm[ids[k]] = { x: cx, y: top };
    for (const k of ["bottom", "bottomAlt1", "bottomAlt2"]) lm[ids[k]] = { x: cx, y: bottom };
    lm[ids.iris] = { x: cx, y: top + height * irisY };
  };
  eye(33, 133, 0.4, 0.46, { top: 159, topAlt1: 158, topAlt2: 160, bottom: 145, bottomAlt1: 144, bottomAlt2: 153, iris: 468 });
  eye(263, 362, 0.6, 0.54, { top: 386, topAlt1: 385, topAlt2: 387, bottom: 374, bottomAlt1: 373, bottomAlt2: 380, iris: 473 });
  return lm;
}

/** A 4×4 column-major head transform with this yaw and pitch, in degrees. */
function pose(yawDeg: number, pitchDeg: number): number[] {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  // R = Ry(yaw) · Rx(-pitch), laid out column-major as MediaPipe returns it.
  const cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(-p), sp = Math.sin(-p);
  const r = [
    [cy, sy * sp, sy * cp],
    [0, cp, -sp],
    [-sy, cy * sp, cy * cp],
  ];
  return [r[0][0], r[1][0], r[2][0], 0, r[0][1], r[1][1], r[2][1], 0, r[0][2], r[1][2], r[2][2], 0, 0, 0, 0, 1];
}

function frames(tracker: TemporalGazeTracker, ms: number, yaw: number, pitch: number, lm = face()) {
  let last;
  for (let t = 0; t < ms; t += FRAME_MS) last = tracker.processFrame(lm, FRAME_MS, pose(yaw, pitch));
  return last!;
}

describe("gaze tracker", () => {
  it("calibrates on a laptop's natural downward reading angle", () => {
    const tracker = new TemporalGazeTracker();
    const reading = frames(tracker, 8_000, 0, 18);
    expect(tracker.getBaseline()).not.toBeNull();
    expect(reading.facing).toBe(true);
    expect(LAPTOP_MAX_REST_PITCH).toBeGreaterThanOrEqual(18);
  });

  it("still catches a real look down at notes after calibrating at a laptop angle", () => {
    const tracker = new TemporalGazeTracker();
    frames(tracker, 8_000, 0, 18);
    expect(frames(tracker, DWELL + 2 * FRAME_MS, 0, 18 + 25).facing).toBe(false);
  });

  it("still catches a student who looks down at notes from the very first second", () => {
    // Never calibrates (always past the laptop angle) — must still be judged.
    const tracker = new TemporalGazeTracker();
    const res = frames(tracker, DWELL + 2 * FRAME_MS, 0, LAPTOP_MAX_REST_PITCH + 20);
    expect(tracker.getBaseline()).toBeNull();
    expect(res.facing).toBe(false);
    expect(res.reason).toBe("looking_down");
  });

  it("does not flag an uncalibrated student reading at a laptop angle", () => {
    const tracker = new TemporalGazeTracker();
    // Wobbling slightly so calibration has not completed yet.
    let last;
    for (let i = 0; i < 6; i++) last = tracker.processFrame(face(), FRAME_MS, pose(0, i % 2 ? 12 : 20));
    expect(last!.facing).toBe(true);
  });

  it("does not calibrate on a moving head", () => {
    const tracker = new TemporalGazeTracker();
    for (let i = 0; i < 12; i++) tracker.processFrame(face(), FRAME_MS, pose(i % 2 ? 8 : -8, i % 2 ? 0 : 15));
    expect(tracker.getBaseline()).toBeNull();
  });

  it("does not count a glance shorter than the dwell time", () => {
    const tracker = new TemporalGazeTracker();
    frames(tracker, 6_000, 0, 5);
    const glance = frames(tracker, DWELL - FRAME_MS, 45, 5);
    expect(glance.state).toBe("SUSPECTED_OFF_SCREEN");
    expect(glance.facing).toBe(true);
  });

  it("confirms a sustained look away once the dwell time has passed", () => {
    const tracker = new TemporalGazeTracker();
    frames(tracker, 6_000, 0, 5);
    const away = frames(tracker, DWELL + FRAME_MS, 45, 5);
    expect(away.state).toBe("OFF_SCREEN_CONFIRMED");
    expect(away.facing).toBe(false);
  });

  it("treats a face that briefly drops out of the mesh like any other glance", () => {
    const tracker = new TemporalGazeTracker();
    expect(tracker.processFrame(null, FRAME_MS).facing).toBe(true);
    let last = tracker.processFrame(null, FRAME_MS);
    for (let t = 2 * FRAME_MS; t <= DWELL; t += FRAME_MS) last = tracker.processFrame(null, FRAME_MS);
    expect(last.facing).toBe(false);
  });
});

describe("iris vertical ratio", () => {
  it("reads the iris when the eye is open", () => {
    const r = extractIrisGazeRatio(face({ irisY: 0.7 }));
    expect(r.irisYReliable).toBe(true);
    expect(r.irisY).toBeCloseTo(0.7, 1);
  });

  it("does not trust it when the student squints — a sliver of eyelid is not a glance", () => {
    const r = extractIrisGazeRatio(face({ aperture: 0.2, irisY: 0.95 }));
    expect(r.blinking).toBe(false);
    expect(r.irisYReliable).toBe(false);
    expect(r.irisY).toBe(0.5);
  });

  it("does not let squinting fake a look down", () => {
    const tracker = new TemporalGazeTracker();
    frames(tracker, 6_000, 0, 5);
    const squinting = frames(tracker, 8_000, 0, 5, face({ aperture: 0.2, irisY: 0.95 }));
    expect(squinting.facing).toBe(true);
  });
});

describe("OffScreenDwell", () => {
  it("is not reset by a single frame back on screen", () => {
    // 2.25 s away, a moment back (drains 1.125 s), 2.25 s away again: 3.375 s.
    const dwell = new OffScreenDwell(3_000);
    dwell.update(true, 2_250);
    dwell.update(false, 750);
    expect(dwell.update(true, 2_250).confirmed).toBe(true);
  });

  it("holds through a blink", () => {
    const dwell = new OffScreenDwell(3_000);
    dwell.update(true, 2_250);
    dwell.update(false, 750, true);
    expect(dwell.update(true, 750).confirmed).toBe(true);
  });
});
