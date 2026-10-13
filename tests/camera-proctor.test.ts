import { describe, expect, it } from "vitest";
import {
  createTracker,
  END_REASON_LABEL,
  END_REASONS,
  endReason,
  isBlockedWithoutFace,
  isCovered,
  NO_FACE_END_MS,
  observe,
  SAMPLE_INTERVAL_MS,
  type CameraSample,
  type TrackerState,
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

describe("camera tracker", () => {
  it("ignores a phone seen for a single frame", () => {
    const { state } = run([{}, phone, {}, {}, {}]);
    expect(state.counters.phoneEvents).toBe(0);
  });

  it("counts a phone held in view as one event, not one per frame", () => {
    const { state, started } = run([phone, phone, phone, phone, phone, phone, phone, phone]);
    expect(state.counters.phoneEvents).toBe(1);
    expect(started).toEqual(["phone"]);
  });

  it("does not stutter when a detection hovers at the threshold", () => {
    // 3 hits switch it on; it only switches off once hits fall to 1 of 5.
    const hovering = [phone, phone, phone, {}, phone, {}, phone, {}, phone, {}, phone];
    expect(run(hovering).state.counters.phoneEvents).toBe(1);
  });

  it("counts a second, separate appearance", () => {
    const appear = [phone, phone, phone, phone];
    const gone = [{}, {}, {}, {}, {}];
    expect(run([...appear, ...gone, ...appear]).state.counters.phoneEvents).toBe(2);
  });

  it("reports a covered lens as covered, not also as an empty desk", () => {
    const covered = Array.from({ length: 10 }, () => ({ covered: true, faces: 0 }));
    const { state } = run(covered);
    expect(state.counters.coveredMs).toBeGreaterThan(0);
    expect(state.counters.noFaceMs).toBe(0);
    expect(state.counters.noFaceEvents).toBe(0);
  });

  it("counts two faces as a helper", () => {
    const { state, started } = run([{ faces: 2 }, { faces: 2 }, { faces: 2 }]);
    expect(state.counters.multiFaceEvents).toBe(1);
    expect(started).toContain("multiple_faces");
  });

  it("only credits absence time while the absence is established", () => {
    // Two empty frames never reach the threshold, so no time is charged.
    expect(run([{ faces: 0 }, { faces: 0 }, {}, {}]).state.counters.noFaceMs).toBe(0);
    // Ten empty frames: on from the third, so eight intervals are credited.
    const long = run(Array.from({ length: 10 }, () => ({ faces: 0 })));
    expect(long.state.counters.noFaceMs).toBe(8 * SAMPLE_INTERVAL_MS);
  });

  it("does not charge a throttled background tab's whole gap", () => {
    // Hidden tabs fire timers about once a minute. That minute was not observed.
    const { state } = run(Array.from({ length: 4 }, () => ({ faces: 0 })), createTracker(), 60_000);
    expect(state.counters.noFaceMs).toBeLessThanOrEqual(2 * 3 * SAMPLE_INTERVAL_MS);
  });

  it("keeps every counter an integer, because the wire schema rejects anything else", () => {
    // performance.now() deltas are fractional. A fractional counter fails
    // signalsSchema, and that schema sits inside every submit route's body —
    // so this would reject the whole submission, not just the camera fields.
    const { state } = run(
      Array.from({ length: 12 }, () => ({ faces: 0 })),
      createTracker(),
      1499.7371,
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

describe("endReason", () => {
  it("does not end a test for one misread frame", () => {
    const { state } = run([{}, phone, {}, {}, {}]);
    expect(endReason(state)).toBeNull();
  });

  it("ends the test once a phone is held in view", () => {
    expect(endReason(run([phone]).state)).toBeNull();
    expect(endReason(run([phone, phone]).state)).toBe("phone");
  });

  it("catches a phone the model only sees in some frames", () => {
    // Measured on a real webcam: a phone in shot is detected, missed, detected.
    // Two hits in the last five samples is enough.
    expect(endReason(run([{}, phone, {}, {}, phone]).state)).toBe("phone");
  });

  it("still needs a second sighting — one misread frame never ends a test", () => {
    expect(endReason(run([phone, {}, {}, {}, {}, {}, phone]).state)).toBeNull();
  });

  it("ends the test for a second person or a covered lens", () => {
    const two = Array.from({ length: 3 }, () => ({ faces: 2 }));
    expect(endReason(run(two).state)).toBe("multiple_faces");
    const dark = Array.from({ length: 3 }, () => ({ covered: true, faces: 0 }));
    expect(endReason(run(dark).state)).toBe("camera_covered");
  });

  it("ends the test once the camera is covered for two samples", () => {
    expect(endReason(run([{ covered: true }]).state)).toBeNull();
    expect(endReason(run([{ covered: true }, { covered: true }]).state)).toBe("camera_covered");
  });

  it("never ends a test for a book — rough work is allowed", () => {
    const books = Array.from({ length: 10 }, () => ({ book: true }));
    const { state } = run(books);
    expect(state.counters.bookEvents).toBe(1);
    expect(endReason(state)).toBeNull();
  });

  it("allows looking away, but not a continuous minute out of frame", () => {
    const away = (n: number) => Array.from({ length: n }, () => ({ faces: 0 }));
    // About 35 seconds away, back, 35 more: past a minute in total, never a minute at once.
    const glances = run([...away(25), {}, {}, {}, {}, {}, ...away(25)]).state;
    expect(glances.counters.noFaceMs).toBeGreaterThan(NO_FACE_END_MS);
    expect(endReason(glances)).toBeNull();
    expect(endReason(run(away(45)).state)).toBe("no_face");
  });

  it("every reason has a label the student is shown", () => {
    for (const r of END_REASONS) expect(END_REASON_LABEL[r]).toBeTruthy();
  });
});
