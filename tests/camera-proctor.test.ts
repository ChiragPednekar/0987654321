import { describe, expect, it } from "vitest";
import {
  createTracker,
  isCovered,
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

  it("sees a finger over the lens", () => {
    expect(isCovered(frame(() => 4))).toBe(true);
  });

  it("does not mistake a dim room for a covered lens", () => {
    // Dark on average, but with edges in it — a face lit by the screen.
    expect(isCovered(frame((i) => (i % 7 === 0 ? 70 : 6)))).toBe(false);
  });

  it("leaves an ordinary frame alone", () => {
    expect(isCovered(frame(() => 120))).toBe(false);
  });

  it("does not call an empty frame covered", () => {
    expect(isCovered(new Uint8ClampedArray(0))).toBe(false);
  });
});
