import { describe, expect, it } from "vitest";
import {
  TemporalGazeTracker,
  calculateEyeAspectRatio,
  MESH_INDICES,
  type NormalizedLandmark,
} from "@/lib/gaze-tracker";
import { AudioVadEngine } from "@/lib/audio-vad";

/**
 * Creates a synthetic 478-landmark FaceLandmarker mesh.
 * Allows simulating head yaw/pitch/roll, eye positions, iris displacement, and blinks.
 */
function createSyntheticLandmarks(options: {
  yawDeg?: number;
  pitchDeg?: number;
  rollDeg?: number;
  irisOffsetX?: number; // -1 (right) to +1 (left)
  irisOffsetY?: number; // -1 (up) to +1 (down)
  eyeOpenRatio?: number; // 1.0 = normal, 0.0 = closed (blink)
}): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = new Array(478);
  for (let i = 0; i < 478; i++) {
    landmarks[i] = { x: 0.5, y: 0.5, z: 0 };
  }

  const {
    yawDeg = 0,
    pitchDeg = 0,
    rollDeg = 0,
    irisOffsetX = 0,
    irisOffsetY = 0,
    eyeOpenRatio = 1.0,
  } = options;

  // Convert angles to radians
  const yawRad = (yawDeg * Math.PI) / 180;
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const rollRad = (rollDeg * Math.PI) / 180;

  // Interpupillary / eye corner baseline distance ~0.25
  const eyeBaseDist = 0.25;

  // Nose tip
  landmarks[MESH_INDICES.noseTip] = {
    x: 0.50 + Math.sin(yawRad) * eyeBaseDist * 0.92,
    y: 0.42 + Math.sin(pitchRad) * eyeBaseDist * 0.85,
    z: -0.05 * Math.cos(yawRad),
  };

  // Chin and Forehead (foreshortened during vertical pitch)
  landmarks[MESH_INDICES.chin] = {
    x: 0.50 + Math.sin(yawRad) * 0.12,
    y: 0.62 - Math.sin(pitchRad) * 0.06,
    z: 0.05,
  };
  landmarks[MESH_INDICES.forehead] = {
    x: 0.50 + Math.sin(yawRad) * 0.12,
    y: 0.20 + Math.sin(pitchRad) * 0.10,
    z: 0.05,
  };

  // Right Eye (Subject right / viewer left)
  const rCenter = { x: 0.42, y: 0.35 };
  const rEyeHalfWidth = 0.045;
  const rEyeHalfHeight = 0.015 * Math.max(0.05, eyeOpenRatio);

  landmarks[MESH_INDICES.rightEye.outer] = {
    x: rCenter.x - rEyeHalfWidth * Math.cos(rollRad),
    y: rCenter.y - rEyeHalfWidth * Math.sin(rollRad),
  };
  landmarks[MESH_INDICES.rightEye.inner] = {
    x: rCenter.x + rEyeHalfWidth * Math.cos(rollRad),
    y: rCenter.y + rEyeHalfWidth * Math.sin(rollRad),
  };
  landmarks[MESH_INDICES.rightEye.top] = { x: rCenter.x, y: rCenter.y - rEyeHalfHeight };
  landmarks[MESH_INDICES.rightEye.topAlt1] = { x: rCenter.x - 0.015, y: rCenter.y - rEyeHalfHeight };
  landmarks[MESH_INDICES.rightEye.topAlt2] = { x: rCenter.x + 0.015, y: rCenter.y - rEyeHalfHeight };
  landmarks[MESH_INDICES.rightEye.bottom] = { x: rCenter.x, y: rCenter.y + rEyeHalfHeight };
  landmarks[MESH_INDICES.rightEye.bottomAlt1] = { x: rCenter.x - 0.015, y: rCenter.y + rEyeHalfHeight };
  landmarks[MESH_INDICES.rightEye.bottomAlt2] = { x: rCenter.x + 0.015, y: rCenter.y + rEyeHalfHeight };

  // Right Iris center
  landmarks[MESH_INDICES.rightEye.irisCenter] = {
    x: rCenter.x + irisOffsetX * (rEyeHalfWidth * 0.7),
    y: rCenter.y + irisOffsetY * (rEyeHalfHeight * 0.7),
  };

  // Left Eye (Subject left / viewer right)
  const lCenter = { x: 0.58, y: 0.35 };
  const lEyeHalfWidth = 0.045;
  const lEyeHalfHeight = 0.015 * Math.max(0.05, eyeOpenRatio);

  landmarks[MESH_INDICES.leftEye.inner] = {
    x: lCenter.x - lEyeHalfWidth * Math.cos(rollRad),
    y: lCenter.y - lEyeHalfWidth * Math.sin(rollRad),
  };
  landmarks[MESH_INDICES.leftEye.outer] = {
    x: lCenter.x + lEyeHalfWidth * Math.cos(rollRad),
    y: lCenter.y + lEyeHalfWidth * Math.sin(rollRad),
  };
  landmarks[MESH_INDICES.leftEye.top] = { x: lCenter.x, y: lCenter.y - lEyeHalfHeight };
  landmarks[MESH_INDICES.leftEye.topAlt1] = { x: lCenter.x - 0.015, y: lCenter.y - lEyeHalfHeight };
  landmarks[MESH_INDICES.leftEye.topAlt2] = { x: lCenter.x + 0.015, y: lCenter.y - lEyeHalfHeight };
  landmarks[MESH_INDICES.leftEye.bottom] = { x: lCenter.x, y: lCenter.y + lEyeHalfHeight };
  landmarks[MESH_INDICES.leftEye.bottomAlt1] = { x: lCenter.x - 0.015, y: lCenter.y + lEyeHalfHeight };
  landmarks[MESH_INDICES.leftEye.bottomAlt2] = { x: lCenter.x + 0.015, y: lCenter.y + lEyeHalfHeight };

  // Left Iris center
  landmarks[MESH_INDICES.leftEye.irisCenter] = {
    x: lCenter.x + irisOffsetX * (lEyeHalfWidth * 0.7),
    y: lCenter.y + irisOffsetY * (lEyeHalfHeight * 0.7),
  };

  return landmarks;
}

/**
 * Creates synthetic audio frequency magnitude bins (0 to 127).
 */
function createSyntheticAudioBins(profile: "silence" | "speech" | "quiet_speech" | "keyboard_click" | "fan_hum" | "impact_thud"): Uint8Array {
  const bins = new Uint8Array(128);

  switch (profile) {
    case "silence":
      for (let i = 0; i < bins.length; i++) {
        bins[i] = Math.floor(Math.random() * 8) + 4; // Flat low floor ~4-12
      }
      break;

    case "speech":
      // Formants at bins 3-15 (~400Hz-2300Hz), low high-frequency
      for (let i = 0; i < bins.length; i++) {
        bins[i] = Math.floor(Math.random() * 10) + 8;
      }
      for (let i = 3; i <= 15; i++) {
        bins[i] = Math.floor(Math.sin((i / 15) * Math.PI) * 110) + 50; // Strong formant peak up to ~160
      }
      break;

    case "quiet_speech":
      for (let i = 0; i < bins.length; i++) {
        bins[i] = Math.floor(Math.random() * 8) + 6;
      }
      for (let i = 3; i <= 15; i++) {
        bins[i] = Math.floor(Math.sin((i / 15) * Math.PI) * 45) + 26; // Moderate formant peak ~70
      }
      break;

    case "keyboard_click":
      // Impulsive click: sharp energy concentrated in 4500Hz-8000Hz (bins 24-55), very low speech formants
      for (let i = 0; i < bins.length; i++) {
        bins[i] = Math.floor(Math.random() * 10) + 8;
      }
      for (let i = 24; i <= 55; i++) {
        bins[i] = Math.floor(Math.random() * 80) + 90; // High clatter energy
      }
      break;

    case "fan_hum":
      // Stationary hum: high energy in bin 0-2 (< 200Hz), flat low energy elsewhere
      for (let i = 0; i < bins.length; i++) {
        bins[i] = Math.floor(Math.random() * 8) + 12;
      }
      bins[0] = 140;
      bins[1] = 110;
      bins[2] = 60;
      break;

    case "impact_thud":
      // Transient wide thud: uniform high flatness across spectrum for 1 frame
      for (let i = 0; i < bins.length; i++) {
        bins[i] = Math.floor(Math.random() * 30) + 80;
      }
      break;
  }

  return bins;
}

describe("Eye-Gaze & Off-Screen Tracking Accuracy Evaluation", () => {
  it("scenario A: center screen gaze produces NORMAL state with high confidence", () => {
    const tracker = new TemporalGazeTracker();
    const frame = createSyntheticLandmarks({ yawDeg: 0, pitchDeg: 0, irisOffsetX: 0, irisOffsetY: 0 });
    const result = tracker.processFrame(frame, 1500);

    expect(result.facing).toBe(true);
    expect(result.state).toBe("NORMAL");
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(result.reason).toBeUndefined();
  });

  it("scenario B: natural reading saccades across screen do NOT trigger false violations", () => {
    const tracker = new TemporalGazeTracker();
    // Simulate reading left to right across monitor: iris moves ±12 degrees, well within screen
    const readLeft = createSyntheticLandmarks({ yawDeg: -4, irisOffsetX: -0.15 });
    const readCenter = createSyntheticLandmarks({ yawDeg: 0, irisOffsetX: 0 });
    const readRight = createSyntheticLandmarks({ yawDeg: 4, irisOffsetX: 0.15 });

    expect(tracker.processFrame(readLeft, 1500).facing).toBe(true);
    expect(tracker.processFrame(readCenter, 1500).facing).toBe(true);
    expect(tracker.processFrame(readRight, 1500).facing).toBe(true);
  });

  it("scenario C: natural blinking is recognized and suppresses false gaze violations", () => {
    const tracker = new TemporalGazeTracker();
    // Normal frame
    const normal = createSyntheticLandmarks({ eyeOpenRatio: 1.0 });
    tracker.processFrame(normal, 1500);

    // Blink frame (eyes closed, eyeOpenRatio = 0.05)
    const blinkFrame = createSyntheticLandmarks({ eyeOpenRatio: 0.05 });
    const ear = calculateEyeAspectRatio(blinkFrame, false);
    expect(ear).toBeLessThan(0.18); // Correct EAR calculation

    const blinkResult = tracker.processFrame(blinkFrame, 200);
    expect(blinkResult.facing).toBe(true); // Must NOT penalize for blinking
    expect(blinkResult.state).toBe("BLINKING");
  });

  it("scenario D: brief glance away (< 2s) is flagged as SUSPECTED but NOT confirmed", () => {
    const tracker = new TemporalGazeTracker();
    // Glance away for 1000ms
    const glanceAway = createSyntheticLandmarks({ yawDeg: 28 });
    const res = tracker.processFrame(glanceAway, 1000);

    expect(res.state).toBe("SUSPECTED_OFF_SCREEN");
    expect(res.facing).toBe(false); // Flagged to preview
    // Dwell requirement not met yet (needs 3000ms), so it's not confirmed
    expect(res.state).not.toBe("OFF_SCREEN_CONFIRMED");

    // Returning to center recovers to NORMAL
    const backToCenter = createSyntheticLandmarks({ yawDeg: 0 });
    const recovered = tracker.processFrame(backToCenter, 1500);
    expect(recovered.facing).toBe(true);
  });

  it("scenario E: sustained off-screen gaze (> 3s) triggers CONFIRMED off-screen state", () => {
    const tracker = new TemporalGazeTracker();
    const offScreen = createSyntheticLandmarks({ yawDeg: 35 });

    tracker.processFrame(offScreen, 1500); // 1500ms -> suspected
    const confirmed = tracker.processFrame(offScreen, 1600); // 3100ms -> confirmed

    expect(confirmed.state).toBe("OFF_SCREEN_CONFIRMED");
    expect(confirmed.facing).toBe(false);
    expect(confirmed.reason).toBe("looking_left");
  });

  it("scenario F: looking down at lap/notes is accurately identified", () => {
    const tracker = new TemporalGazeTracker();
    const lookingDown = createSyntheticLandmarks({ pitchDeg: 25, irisOffsetY: 0.4 });
    const res = tracker.processFrame(lookingDown, 1500);

    expect(res.facing).toBe(false);
    expect(res.reason).toBe("looking_down");
    expect(res.tip).toContain("Looking down");
  });

  it("scenario G: eye gaze deviation without head movement is caught by iris tracker", () => {
    const tracker = new TemporalGazeTracker();
    // Head straight, but eyes looking far sideways
    const sideGaze = createSyntheticLandmarks({ yawDeg: 0, irisOffsetX: 0.65 });
    const res = tracker.processFrame(sideGaze, 1500);

    expect(res.facing).toBe(false);
    expect(res.reason).toBe("looking_left");
  });

  it("scenario H: off-center webcam baseline calibration corrects resting posture", () => {
    const tracker = new TemporalGazeTracker();
    // Student sits with a laptop tilted, resting posture has +8 deg yaw
    tracker.setBaseline({
      headYaw: 8.0,
      headPitch: 0,
      headRoll: 0,
      irisX: 0.5,
      irisY: 0.5,
    });

    const restingFrame = createSyntheticLandmarks({ yawDeg: 8.0 });
    const result = tracker.processFrame(restingFrame, 1500);
    expect(result.facing).toBe(true);
    expect(result.state).toBe("NORMAL");
  });

  it("scenario I: face missing flags FACE_NOT_VISIBLE instead of gaze violation", () => {
    const tracker = new TemporalGazeTracker();
    const result = tracker.processFrame(null, 1500);

    expect(result.facing).toBe(false);
    expect(result.state).toBe("FACE_NOT_VISIBLE");
    expect(result.reason).toBe("face_not_visible");
  });
});

describe("Audio VAD Speech Detection Accuracy Evaluation", () => {
  it("scenario 1: silence and ambient noise do NOT trigger speech", () => {
    const vad = new AudioVadEngine();
    const silence = createSyntheticAudioBins("silence");
    const result = vad.processFrame(silence, null, 1000, 100);

    expect(result.activeSpeech).toBe(false);
    expect(result.metrics.speechProbability).toBeLessThan(0.3);
    expect(result.confirmedEvent).toBeNull();
  });

  it("scenario 2: continuous human speech is detected with high confidence", () => {
    const vad = new AudioVadEngine();
    const speech = createSyntheticAudioBins("speech");

    // Process speech over 500ms
    vad.processFrame(speech, null, 100, 100);
    vad.processFrame(speech, null, 200, 100);
    vad.processFrame(speech, null, 300, 100);
    const confirmed = vad.processFrame(speech, null, 450, 150);

    expect(confirmed.activeSpeech).toBe(true);
    expect(confirmed.metrics.speechProbability).toBeGreaterThan(0.65);
    expect(confirmed.metrics.snrDb).toBeGreaterThan(10);
    expect(confirmed.confirmedEvent).not.toBeNull();
  });

  it("scenario 3: quiet speech is reliably detected without loud yelling", () => {
    const vad = new AudioVadEngine();
    const quiet = createSyntheticAudioBins("quiet_speech");

    vad.processFrame(quiet, null, 100, 100);
    vad.processFrame(quiet, null, 200, 100);
    vad.processFrame(quiet, null, 300, 100);
    const res = vad.processFrame(quiet, null, 450, 150);

    expect(res.activeSpeech).toBe(true);
    expect(res.metrics.speechProbability).toBeGreaterThan(0.5);
  });

  it("scenario 4: keyboard clatter and mouse clicks are REJECTED (Zero False Positives)", () => {
    const vad = new AudioVadEngine();
    const click = createSyntheticAudioBins("keyboard_click");

    for (let t = 100; t <= 1000; t += 100) {
      const res = vad.processFrame(click, null, t, 100);
      expect(res.activeSpeech).toBe(false);
      expect(res.confirmedEvent).toBeNull();
    }
  });

  it("scenario 5: continuous fan and air-conditioning hum are REJECTED", () => {
    const vad = new AudioVadEngine();
    const fan = createSyntheticAudioBins("fan_hum");

    for (let t = 100; t <= 1500; t += 100) {
      const res = vad.processFrame(fan, null, t, 100);
      expect(res.activeSpeech).toBe(false);
      expect(res.confirmedEvent).toBeNull();
    }
  });

  it("scenario 6: single impulse / pen drop is filtered by burst duration filter", () => {
    const vad = new AudioVadEngine();
    const thud = createSyntheticAudioBins("impact_thud");

    // Single 100ms burst followed by silence
    const burst = vad.processFrame(thud, null, 100, 100);
    const silence = vad.processFrame(createSyntheticAudioBins("silence"), null, 200, 100);

    expect(burst.confirmedEvent).toBeNull();
    expect(silence.confirmedEvent).toBeNull();
  });

  it("scenario 7: short pauses within a sentence are merged via gap merging", () => {
    const vad = new AudioVadEngine();
    const speech = createSyntheticAudioBins("speech");
    const silence = createSyntheticAudioBins("silence");

    // Word 1: 400ms speech
    vad.processFrame(speech, null, 100, 100);
    vad.processFrame(speech, null, 200, 100);
    vad.processFrame(speech, null, 300, 100);
    const event1 = vad.processFrame(speech, null, 400, 100).confirmedEvent;
    expect(event1).not.toBeNull();

    // Natural 250ms inter-word pause (below 450ms gap merge threshold)
    vad.processFrame(silence, null, 500, 100);
    vad.processFrame(silence, null, 650, 150);

    // Word 2: resumed speech
    const word2 = vad.processFrame(speech, null, 750, 100);
    expect(word2.activeSpeech).toBe(true);
  });
});
