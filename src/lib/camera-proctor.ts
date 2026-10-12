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
 * At a sample every 1.5s that means most conditions need roughly 4.5 seconds
 * in view across a 7.5-second span before anything is counted.
 *
 * A phone needs only two of the five samples. Measured on a real webcam, the
 * object model's confidence for a phone held in front of the camera hovers
 * around its threshold — in shot for ten seconds, it is seen in some frames and
 * missed in others — so three hits out of five was rarely reached and phones
 * went unnoticed. Two still ignores a single misread frame.
 */

export const SAMPLE_INTERVAL_MS = 1500;

/** Samples kept per condition. */
const WINDOW = 5;
/** Hits in the window needed to switch a condition on. */
const ACTIVATE_AT = 3;
/** The same, for a phone. See "Why everything is debounced" above. */
const PHONE_ACTIVATE_AT = 2;
/** Hits in the window at or below which it switches off again. */
const RELEASE_AT = 1;

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
}

/** The kinds of moment worth one evidence photo. */
export type SnapshotKind = "phone" | "multiple_faces" | "no_face" | "book";

/** Counters reported with the attempt. Mirrors the camera fields on ProctorSignals. */
export interface CameraCounters {
  cameraSamples: number;
  noFaceMs: number;
  noFaceEvents: number;
  multiFaceEvents: number;
  phoneEvents: number;
  bookEvents: number;
  coveredMs: number;
}

export const EMPTY_CAMERA_COUNTERS: CameraCounters = {
  cameraSamples: 0,
  noFaceMs: 0,
  noFaceEvents: 0,
  multiFaceEvents: 0,
  phoneEvents: 0,
  bookEvents: 0,
  coveredMs: 0,
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
  /**
   * How long nobody has been in frame without a break. Not a counter — it is
   * not reported — but what END_RULES reads: `noFaceMs` adds up every absence,
   * so three short glances down at rough work would eventually reach any
   * total, while a continuous minute away from the desk is a different thing.
   */
  noFaceRunMs: number;
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
    noFaceRunMs: 0,
  };
}

/** Pushes one sample into a condition. Returns the new condition and whether it just switched on. */
function step(
  c: Condition,
  hit: boolean,
  activateAt = ACTIVATE_AT,
): { next: Condition; rose: boolean } {
  const hits = [...c.hits, hit].slice(-WINDOW);
  const count = hits.filter(Boolean).length;

  let active = c.active;
  if (!active && count >= activateAt) active = true;
  else if (active && count <= RELEASE_AT) active = false;

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
  const covered = step(state.covered, sample.covered);
  const seeing = !sample.covered;

  const noFace = step(state.noFace, seeing && sample.faces === 0);
  const multiFace = step(state.multiFace, seeing && sample.faces >= 2);
  const phone = step(state.phone, seeing && sample.phone, PHONE_ACTIVATE_AT);
  const book = step(state.book, seeing && sample.book);

  const c = state.counters;
  const counters: CameraCounters = {
    cameraSamples: c.cameraSamples + 1,
    noFaceMs: c.noFaceMs + (noFace.next.active ? credit : 0),
    noFaceEvents: c.noFaceEvents + (noFace.rose ? 1 : 0),
    multiFaceEvents: c.multiFaceEvents + (multiFace.rose ? 1 : 0),
    phoneEvents: c.phoneEvents + (phone.rose ? 1 : 0),
    bookEvents: c.bookEvents + (book.rose ? 1 : 0),
    coveredMs: c.coveredMs + (covered.next.active ? credit : 0),
  };

  const started: SnapshotKind[] = [];
  if (phone.rose) started.push("phone");
  if (multiFace.rose) started.push("multiple_faces");
  if (noFace.rose) started.push("no_face");
  if (book.rose) started.push("book");

  return {
    state: {
      counters,
      noFace: noFace.next,
      multiFace: multiFace.next,
      phone: phone.next,
      book: book.next,
      covered: covered.next,
      noFaceRunMs: noFace.next.active ? state.noFaceRunMs + credit : 0,
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
  | "tab_switch";

export const END_REASONS: readonly EndReason[] = [
  "phone",
  "multiple_faces",
  "camera_covered",
  "no_face",
  "camera_off",
  "tab_switch",
];

/** Said to the student on the ended screen, and to whoever reviews it. */
export const END_REASON_LABEL: Record<EndReason, string> = {
  phone: "A phone was seen on camera",
  multiple_faces: "Another person was seen on camera",
  camera_covered: "The camera was covered",
  no_face: "You were away from the camera for over a minute",
  camera_off: "The camera was switched off",
  tab_switch: "You left the test window",
};

/** Continuous time out of frame that ends an attempt. */
export const NO_FACE_END_MS = 60_000;

/**
 * Whether what the camera is seeing now ends the attempt.
 *
 * It reads the debounced conditions, never a raw frame: a phone has to be in
 * view for 3 of the last 5 samples — about 4.5 seconds — before this fires,
 * the same bar that makes it an event at all. One misread frame cannot end
 * anyone's test.
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
  if (state.noFaceRunMs >= NO_FACE_END_MS) return "no_face";
  return null;
}

/**
 * Brightness below which a frame counts as covered, on a 0-255 scale.
 *
 * A dim room lit only by the laptop screen still puts a face at roughly 30-60.
 * A finger or tape over the lens reads close to zero and almost perfectly
 * flat, which is why the spread matters as much as the mean: a dark but real
 * scene still has edges in it.
 */
const COVERED_MEAN_BELOW = 16;
const COVERED_SPREAD_BELOW = 8;

/**
 * Decides from raw RGBA pixels whether the lens is covered.
 *
 * Takes a tiny frame — the hook scales the video down to 32×24 first — so this
 * costs a few hundred additions, not a pass over a full HD frame.
 */
export function isCovered(rgba: ArrayLike<number>): boolean {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return false;

  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    // Rec. 601 luma — what the eye reads as brightness.
    const y = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
    sum += y;
    sumSq += y * y;
  }
  const mean = sum / pixels;
  const spread = Math.sqrt(Math.max(0, sumSq / pixels - mean * mean));
  return mean < COVERED_MEAN_BELOW && spread < COVERED_SPREAD_BELOW;
}
