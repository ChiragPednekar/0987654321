import { describe, expect, it } from "vitest";
import {
  checkPoseAndGaze,
  createTracker,
  END_REASON_LABEL,
  END_REASONS,
  endReason,
  isBlockedWithoutFace,
  isCovered,
  NO_FACE_END_MS,
  observe,
  SAMPLE_INTERVAL_MS,
  MAX_LOOKING_AWAY_STRIKES,
  MAX_VOICE_STRIKES,
  type CameraSample,
  type TrackerState,
  DARK_MEAN,
  DIM_MEAN,
  frameBrightness,
  isTooDark,
  TOO_DARK_END_MS,
} from "@/lib/camera-proctor";
import { signalsSchema } from "@/lib/integrity-request";
import { EMPTY_SIGNALS } from "@/lib/integrity";

const SEEN: CameraSample = { faces: 1, phone: false, book: false, covered: false };

/** Feeds samples one interval apart and returns the final state plus every snapshot kind raised. */
function run(samples: Partial<CameraSample>[], start: TrackerState = createTracker(), gap = SAMPLE_INTERVAL_MS) {
  let state = start;
  const started: string[] = [];
  for (const s of samples) {
    const o = observe(state, { ...SEEN, ...s }, gap);
    state = o.state;
    started.push(...o.started);
  }
  return { state, started };
}

const phone = { phone: true };

/**
 * A sample held for a duration. The tracker's windows are defined in time, so
 * the tests are too: these hold whatever SAMPLE_INTERVAL_MS is.
 */
const hold = (ms: number, sample: Partial<CameraSample> = {}) =>
  Array.from({ length: Math.max(1, Math.round(ms / SAMPLE_INTERVAL_MS)) }, () => sample);
const one = (sample: Partial<CameraSample> = {}) => [sample];

describe("camera tracker", () => {
  it("samples often enough to see a one-second glance", () => {
    expect(SAMPLE_INTERVAL_MS).toBeLessThanOrEqual(750);
  });

  it("ignores a phone seen for a single frame", () => {
    const { state } = run([...hold(1_500), ...one(phone), ...hold(4_000)]);
    expect(state.counters.phoneEvents).toBe(0);
  });

  it("counts a phone held in view as one event, not one per frame", () => {
    const { state, started } = run(hold(12_000, phone));
    expect(state.counters.phoneEvents).toBe(1);
    expect(started).toEqual(["phone"]);
  });

  it("does not stutter when a detection hovers at the threshold", () => {
    // Seen, missed, seen, missed for ten seconds: one appearance, not several.
    const hovering = Array.from({ length: Math.round(10_000 / SAMPLE_INTERVAL_MS) }, (_, i) =>
      i % 2 === 0 ? phone : {},
    );
    expect(run(hovering).state.counters.phoneEvents).toBe(1);
  });

  it("counts a second, separate appearance", () => {
    const appear = hold(4_500, phone);
    const gone = hold(8_000);
    expect(run([...appear, ...gone, ...appear]).state.counters.phoneEvents).toBe(2);
  });

  it("reports a covered lens as covered, not also as an empty desk", () => {
    const { state } = run(hold(15_000, { covered: true, faces: 0 }));
    expect(state.counters.coveredMs).toBeGreaterThan(0);
    expect(state.counters.noFaceMs).toBe(0);
    expect(state.counters.noFaceEvents).toBe(0);
  });

  it("counts two faces as a helper", () => {
    const { state, started } = run(hold(5_000, { faces: 2 }));
    expect(state.counters.multiFaceEvents).toBe(1);
    expect(started).toContain("multiple_faces");
  });

  it("only credits absence time while the absence is established", () => {
    // Three seconds empty never reaches the 4.5-second bar, so nothing is charged.
    expect(run([...hold(3_000, { faces: 0 }), ...hold(3_000)]).state.counters.noFaceMs).toBe(0);
    // Fifteen seconds empty: charged from the moment the bar is reached.
    const long = run(hold(15_000, { faces: 0 }));
    expect(long.state.counters.noFaceMs).toBeGreaterThan(9_000);
    expect(long.state.counters.noFaceMs).toBeLessThan(15_000);
  });

  it("does not charge a throttled background tab's whole gap", () => {
    // Hidden tabs fire timers about once a minute. That minute was not observed.
    const { state } = run(Array.from({ length: 10 }, () => ({ faces: 0 })), createTracker(), 60_000);
    expect(state.counters.noFaceMs).toBeLessThanOrEqual(10 * 3 * SAMPLE_INTERVAL_MS);
  });

  it("keeps every counter an integer, because the wire schema rejects anything else", () => {
    // performance.now() deltas are fractional. A fractional counter fails
    // signalsSchema, and that schema sits inside every submit route's body —
    // so this would reject the whole submission, not just the camera fields.
    const { state } = run(
      Array.from({ length: 30 }, () => ({ faces: 0 })),
      createTracker(),
      SAMPLE_INTERVAL_MS - 0.2629,
    );
    for (const value of Object.values(state.counters)) expect(Number.isInteger(value)).toBe(true);

    const parsed = signalsSchema.safeParse({
      ...EMPTY_SIGNALS,
      ...state.counters,
      cameraRequested: true,
      cameraGranted: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("counts a confirmed look away at the first sample — it was already debounced upstream", () => {
    const { state } = run([...one({ lookingAway: true }), ...hold(3_000)]);
    expect(state.counters.lookingAwayEvents).toBe(1);
  });

  it("counts a short confirmed utterance — a 1–2 second question is not discarded", () => {
    const { state } = run([...one({ voiceDetected: true }), ...hold(3_000)]);
    expect(state.counters.voiceEvents).toBe(1);
  });

  it("treats one continuous look away as one strike, and a separate one as another", () => {
    const away = hold(4_000, { lookingAway: true });
    const back = hold(3_000);
    expect(run([...away, ...back]).state.counters.lookingAwayEvents).toBe(1);
    expect(run([...away, ...back, ...away, ...back]).state.counters.lookingAwayEvents).toBe(2);
  });
});

describe("endReason", () => {
  it("does not end a test for one misread frame", () => {
    const { state } = run([...hold(1_500), ...one(phone), ...hold(3_000)]);
    expect(endReason(state)).toBeNull();
  });

  it("ends the test once a phone is held in view", () => {
    expect(endReason(run(one(phone)).state)).toBeNull();
    expect(endReason(run(hold(3_000, phone)).state)).toBe("phone");
  });

  it("catches a phone the model only sees in some frames", () => {
    // Measured on a real webcam: a phone in shot is detected, missed, detected.
    const flicker = Array.from({ length: Math.round(7_500 / SAMPLE_INTERVAL_MS) }, (_, i) =>
      i % 2 === 0 ? phone : {},
    );
    expect(endReason(run(flicker).state)).toBe("phone");
  });

  it("still needs repeated sightings — one misread frame never ends a test", () => {
    expect(endReason(run([...one(phone), ...hold(6_000), ...one(phone)]).state)).toBeNull();
  });

  it("ends the test for a second person or a covered lens", () => {
    expect(endReason(run(hold(5_000, { faces: 2 })).state)).toBe("multiple_faces");
    expect(endReason(run(hold(3_000, { covered: true, faces: 0 })).state)).toBe("camera_covered");
  });

  it("ends the test once the camera is covered for about three seconds", () => {
    expect(endReason(run(one({ covered: true })).state)).toBeNull();
    expect(endReason(run(hold(3_000, { covered: true })).state)).toBe("camera_covered");
  });

  it("never ends a test for a book — rough work is allowed", () => {
    const { state } = run(hold(15_000, { book: true }));
    expect(state.counters.bookEvents).toBe(1);
    expect(endReason(state)).toBeNull();
  });

  it("allows looking away, but not a continuous minute out of frame", () => {
    // About 35 seconds away, back, 35 more: past a minute in total, never a minute at once.
    const glances = run([...hold(35_000, { faces: 0 }), ...hold(7_500), ...hold(35_000, { faces: 0 })]).state;
    expect(glances.counters.noFaceMs).toBeGreaterThan(NO_FACE_END_MS);
    expect(endReason(glances)).toBeNull();
    expect(endReason(run(hold(70_000, { faces: 0 })).state)).toBe("no_face");
  });

  it("every reason has a label the student is shown", () => {
    for (const r of END_REASONS) expect(END_REASON_LABEL[r]).toBeTruthy();
  });

  it("suspends on the 5th looking-away strike — when the counter reads 5/5", () => {
    let state = createTracker();
    const glance = one({ lookingAway: true });
    const back = hold(3_000);

    for (let i = 1; i <= 4; i++) {
      state = run([...glance, ...back], state).state;
      expect(state.counters.lookingAwayEvents).toBe(i);
      expect(endReason(state)).toBeNull();
    }

    const fifth = run(glance, state).state;
    expect(fifth.counters.lookingAwayEvents).toBe(MAX_LOOKING_AWAY_STRIKES);
    expect(endReason(fifth)).toBe("looking_away");
    expect(END_REASON_LABEL[endReason(fifth)!]).toContain("looked away");
  });

  it("suspends on the 3rd voice strike — when the counter reads 3/3", () => {
    let state = createTracker();
    const speaking = one({ voiceDetected: true });
    const silent = hold(3_000);

    for (let i = 1; i <= 2; i++) {
      state = run([...speaking, ...silent], state).state;
      expect(state.counters.voiceEvents).toBe(i);
      expect(endReason(state)).toBeNull();
    }

    const third = run(speaking, state).state;
    expect(third.counters.voiceEvents).toBe(MAX_VOICE_STRIKES);
    expect(endReason(third)).toBe("voice_detected");
    expect(END_REASON_LABEL[endReason(third)!]).toContain("voice was detected");
  });
});

describe("isCovered", () => {
  const frame = (fill: (i: number) => number) => {
    const px = new Uint8ClampedArray(32 * 24 * 4);
    for (let i = 0; i < 32 * 24; i++) {
      const v = fill(i);
      px.set([v, v, v, 255], i * 4);
    }
    return px;
  };

  it("sees a dark covered lens (shutter, dark tape)", () => {
    expect(isCovered(frame(() => 4))).toBe(true);
  });

  it("sees a finger or skin over the lens in ambient light", () => {
    expect(isCovered(frame((i) => 35 + (i % 2)))).toBe(true);
  });

  it("sees tape, post-it notes, or paper over the lens", () => {
    expect(isCovered(frame(() => 160))).toBe(true);
    expect(isCovered(frame(() => 200))).toBe(true);
  });

  it("does not mistake a dim room for a covered lens", () => {
    // Dark on average, but with edges in it — a face lit by the screen.
    expect(isCovered(frame((i) => (i % 7 === 0 ? 70 : 6)))).toBe(false);
  });

  it("leaves an ordinary frame with room contrast alone", () => {
    expect(isCovered(frame((i) => (i % 2 === 0 ? 140 : 100)))).toBe(false);
  });

  it("does not call an empty frame covered", () => {
    expect(isCovered(new Uint8ClampedArray(0))).toBe(false);
  });

  it("catches loose camera obstruction when face detector confirmed 0 faces", () => {
    // Loose hand or card held close to hide the face
    const loose = frame((i) => 40 + Math.floor((i % 32) / 2));
    expect(isBlockedWithoutFace(loose)).toBe(true);

    // Normal student working/looking down: high natural scene contrast
    const student = frame((i) => (i % 2 === 0 ? 160 : 60));
    expect(isBlockedWithoutFace(student)).toBe(false);
  });
});

describe("checkPoseAndGaze", () => {
  it("detects when student is directly facing the screen", () => {
    const frontal = [
      { x: 0.45, y: 0.35 }, // right eye
      { x: 0.55, y: 0.35 }, // left eye
      { x: 0.50, y: 0.39 }, // nose
      { x: 0.50, y: 0.43 }, // mouth
    ];
    expect(checkPoseAndGaze(frontal)).toMatchObject({ facing: true });
  });

  it("detects when student turns their head to the side", () => {
    const turned = [
      { x: 0.47, y: 0.35 },
      { x: 0.56, y: 0.35 },
      { x: 0.55, y: 0.39 }, // nose displaced towards left eye
      { x: 0.53, y: 0.43 },
    ];
    const res = checkPoseAndGaze(turned);
    expect(res.facing).toBe(false);
    expect(res.reason).toMatch(/looking_/);
  });

  it("detects when student looks down at desk, lap, or notes", () => {
    const lookingDown = [
      { x: 0.45, y: 0.35 },
      { x: 0.55, y: 0.35 },
      { x: 0.50, y: 0.37 },
      { x: 0.50, y: 0.39 }, // mouth foreshortened/compressed upwards towards eyes
    ];
    expect(checkPoseAndGaze(lookingDown)).toMatchObject({ facing: false, reason: "looking_down" });
  });

  it("detects when student looks up at ceiling or tilts head severely", () => {
    const lookingUp = [
      { x: 0.45, y: 0.35 },
      { x: 0.55, y: 0.35 },
      { x: 0.50, y: 0.36 }, // nose too high
      { x: 0.50, y: 0.46 },
    ];
    expect(checkPoseAndGaze(lookingUp)).toMatchObject({ facing: false, reason: "looking_up" });

    const tilted = [
      { x: 0.45, y: 0.30 },
      { x: 0.55, y: 0.40 }, // strong vertical eye disparity
      { x: 0.50, y: 0.42 },
      { x: 0.50, y: 0.46 },
    ];
    expect(checkPoseAndGaze(tilted)).toMatchObject({ facing: false, reason: "head_tilted" });
  });

  it("accounts for baseline resting pose calibration", () => {
    // A student whose laptop is lower than usual might rest with a slightly lower vMouth
    const restingPose = [
      { x: 0.45, y: 0.35 },
      { x: 0.55, y: 0.35 },
      { x: 0.50, y: 0.39 },
      { x: 0.50, y: 0.42 }, // vMouth = 0.70 (below default 0.75, but above absolute cutoff 0.52)
    ];
    // With calibrated baseline, resting is recognized as facing
    const baseline = { vMouth: 0.70, yawDelta: 0 };
    expect(checkPoseAndGaze(restingPose, baseline)).toMatchObject({ facing: true });

    // A further downward drop beyond the baseline triggers looking_down
    const droppedDown = [
      { x: 0.45, y: 0.35 },
      { x: 0.55, y: 0.35 },
      { x: 0.50, y: 0.38 },
      { x: 0.50, y: 0.39 }, // vMouth = 0.40 (drop > 0.22)
    ];
    expect(checkPoseAndGaze(droppedDown, baseline)).toMatchObject({
      facing: false,
      reason: "looking_down",
    });
  });

  it("uses ear keypoints for 3D yaw assistance when visible", () => {
    // Face turned horizontally with ears visible
    const turnedWithEars = [
      { x: 0.45, y: 0.35 }, // right eye
      { x: 0.55, y: 0.35 }, // left eye
      { x: 0.50, y: 0.39 }, // nose
      { x: 0.50, y: 0.43 }, // mouth
      { x: 0.38, y: 0.35 }, // right ear close
      { x: 0.75, y: 0.35 }, // left ear far (ratio > 2.0)
    ];
    const res = checkPoseAndGaze(turnedWithEars);
    expect(res.facing).toBe(false);
  });
});


describe("too dark to see the student", () => {
  const dark = { dark: true, faces: 0 };

  it("ends the attempt after TOO_DARK_END_MS of darkness", () => {
    const { state, started } = run(hold(TOO_DARK_END_MS + SAMPLE_INTERVAL_MS, dark));
    expect(endReason(state)).toBe("too_dark");
    expect(started).toContain("too_dark");
    expect(state.counters.darkMs).toBeGreaterThan(0);
  });

  it("does not end it a moment early — the student has the whole countdown to turn on a light", () => {
    const { state } = run(hold(TOO_DARK_END_MS - 2 * SAMPLE_INTERVAL_MS, dark));
    expect(endReason(state)).toBeNull();
  });

  it("starts the countdown again once the light comes back", () => {
    const { state } = run([...hold(10_000, dark), ...hold(1_500), ...hold(10_000, dark)]);
    expect(endReason(state)).toBeNull();
  });

  it("is one finding, not also an empty desk, a phone or a second person", () => {
    const { state } = run(hold(TOO_DARK_END_MS - 2 * SAMPLE_INTERVAL_MS, { ...dark, phone: true }));
    expect(state.counters.noFaceEvents).toBe(0);
    expect(state.counters.noFaceMs).toBe(0);
    expect(state.counters.phoneEvents).toBe(0);
  });

  it("calls a covered lens covered, not dark", () => {
    const { state } = run(hold(TOO_DARK_END_MS + 2_000, { covered: true, dark: true, faces: 0 }));
    expect(endReason(state)).toBe("camera_covered");
    expect(state.counters.darkMs).toBe(0);
  });

  it("has a label for the student and a place in the reasons list", () => {
    expect(END_REASONS).toContain("too_dark");
    expect(END_REASON_LABEL.too_dark).toMatch(/too dark/i);
  });
});

describe("isTooDark", () => {
  it("is too dark below DARK_MEAN, whatever the face detector says", () => {
    expect(isTooDark(DARK_MEAN - 1, 1)).toBe(true);
    expect(isTooDark(5, 0)).toBe(true);
  });

  it("allows a dim room while the student can still be seen", () => {
    expect(isTooDark(DIM_MEAN - 10, 1)).toBe(false);
  });

  it("is too dark when dim AND nobody can be found", () => {
    expect(isTooDark(DIM_MEAN - 10, 0)).toBe(true);
  });

  it("leaves an ordinary lit room alone even with nobody in frame — that is 'no face', not darkness", () => {
    expect(isTooDark(120, 0)).toBe(false);
  });

  it("measures brightness as the eye reads it", () => {
    const px = new Uint8ClampedArray(32 * 24 * 4);
    for (let i = 0; i < 32 * 24; i++) px.set([100, 100, 100, 255], i * 4);
    expect(frameBrightness(px)).toBeCloseTo(100, 5);
    expect(frameBrightness(new Uint8ClampedArray(0))).toBe(0);
  });
});
