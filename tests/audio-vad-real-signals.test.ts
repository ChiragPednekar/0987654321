import { describe, expect, it } from "vitest";
import { AudioVadEngine, recognisedWords } from "@/lib/audio-vad";
import { DEFAULT_PROCTOR_CONFIG } from "@/lib/proctor-config";

/**
 * The detector fed real waveforms, analysed the way the browser's
 * AnalyserNode does (Blackman window, magnitude in dB, mapped from −100..−30 dB
 * onto 0–255), rather than hand-drawn spectra.
 *
 * Pinned because a student alone in a silent room had a test ended for
 * "speaking": the old detector scored an empty room at its speech threshold.
 */

const RATE = 48_000;
const FFT = DEFAULT_PROCTOR_CONFIG.audio.fftSize;
const PITCH_FFT = DEFAULT_PROCTOR_CONFIG.audio.pitchFftSize;
const FRAME_MS = 100;
const FRAME_SAMPLES = (RATE * FRAME_MS) / 1000;

/** Deterministic noise, so a failure reproduces. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Source = (n: number, t: number) => number; // sample index, time in seconds

const silence: Source = () => 0;

function whiteNoise(rms: number, seed: number): Source {
  const r = rng(seed);
  return () => (r() * 2 - 1) * rms * Math.sqrt(3);
}

/** Low-frequency rumble: white noise through a one-pole low-pass — a fan or an AC. */
function fan(rms: number, seed: number): Source {
  const r = rng(seed);
  let y = 0;
  return () => {
    y = 0.98 * y + 0.02 * (r() * 2 - 1);
    return y * rms * 12;
  };
}

/** Mains hum: 50 Hz and its first harmonics. Periodic, but below the speech band. */
function mainsHum(amp: number): Source {
  return (_n, t) => amp * (Math.sin(2 * Math.PI * 50 * t) + 0.5 * Math.sin(2 * Math.PI * 100 * t) + 0.25 * Math.sin(2 * Math.PI * 150 * t));
}

/** Typing: sharp decaying bursts of high-frequency noise, `perSecond` of them. */
function keyboard(amp: number, perSecond: number, seed: number): Source {
  const r = rng(seed);
  let left = 0;
  return () => {
    if (left <= 0 && r() < perSecond / RATE) left = 600;
    if (left <= 0) return 0;
    left--;
    const hiss = r() * 2 - 1;
    return amp * hiss * (left / 600);
  };
}

/**
 * A voiced vowel: a 130 Hz fundamental with harmonics shaped by formant
 * resonances at 700, 1,200 and 2,500 Hz — the periodic, formant-heavy sound
 * of someone talking.
 */
function voice(rms: number, f0 = 130): Source {
  const formants = [700, 1_200, 2_500];
  const harmonics: { f: number; a: number }[] = [];
  for (let k = 1; k * f0 < 4_000; k++) {
    const f = k * f0;
    const a = formants.reduce((s, F) => s + 1 / (1 + ((f - F) / 150) ** 2), 0.05);
    harmonics.push({ f, a });
  }
  const norm = Math.sqrt(harmonics.reduce((s, h) => s + (h.a * h.a) / 2, 0));
  return (_n, t) => (rms / norm) * harmonics.reduce((s, h) => s + h.a * Math.sin(2 * Math.PI * h.f * t), 0);
}

const mix = (...sources: Source[]): Source => (n, t) => sources.reduce((s, src) => s + src(n, t), 0);

/** What AnalyserNode.getByteFrequencyData returns for these samples (no smoothing). */
function byteSpectrum(samples: Float32Array): Uint8Array {
  const n = samples.length;
  const out = new Uint8Array(n / 2);
  for (let k = 0; k < n / 2; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / n) + 0.08 * Math.cos((4 * Math.PI * i) / n);
      const x = samples[i] * w;
      re += x * Math.cos((2 * Math.PI * k * i) / n);
      im -= x * Math.sin((2 * Math.PI * k * i) / n);
    }
    const mag = Math.sqrt(re * re + im * im) / n;
    const db = 20 * Math.log10(Math.max(mag, 1e-12));
    out[k] = Math.max(0, Math.min(255, Math.round(((db + 100) / 70) * 255)));
  }
  return out;
}

/** What getByteTimeDomainData returns. */
function byteWaveform(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(128 + samples[i] * 128)));
  return out;
}

/**
 * Plays a script of [source, milliseconds] through the detector, 100 ms a
 * frame, and reports what it decided.
 */
function play(script: [Source, number][]) {
  const vad = new AudioVadEngine();
  vad.configureSpectrum(RATE, FFT);
  const history = new Float32Array(PITCH_FFT);
  let n = 0;
  let nowMs = 0;
  const frames: { at: number; sustained: boolean; event: boolean; instant: boolean }[] = [];
  for (const [source, ms] of script) {
    for (let f = 0; f < ms / FRAME_MS; f++) {
      history.copyWithin(0, FRAME_SAMPLES);
      for (let i = PITCH_FFT - FRAME_SAMPLES; i < PITCH_FFT; i++) {
        history[i] = source(n, n / RATE);
        n++;
      }
      nowMs += FRAME_MS;
      const r = vad.processFrame(byteSpectrum(history.subarray(PITCH_FFT - FFT)), byteWaveform(history), nowMs, FRAME_MS);
      frames.push({ at: nowMs, sustained: r.sustainedSpeech, event: r.confirmedEvent !== null, instant: r.metrics.isSpeechInstantaneous });
    }
  }
  return {
    everSustained: frames.some((f) => f.sustained),
    events: frames.filter((f) => f.event).length,
    instantFrames: frames.filter((f) => f.instant).length,
    firstSustainedAt: frames.find((f) => f.sustained)?.at ?? null,
  };
}

const ROOM = whiteNoise(0.0008, 1); // a quiet room: mic self-noise and distant air

describe("voice detection on real signals", () => {
  it("never hears speech in a silent room", () => {
    const r = play([[ROOM, 20_000]]);
    expect(r.everSustained).toBe(false);
    expect(r.events).toBe(0);
  });

  it("never hears speech in digital silence", () => {
    expect(play([[silence, 5_000]]).events).toBe(0);
  });

  it("ignores a fan or AC, including one that switches on mid-test", () => {
    const r = play([
      [ROOM, 5_000],
      [mix(ROOM, fan(0.02, 2)), 15_000],
    ]);
    expect(r.everSustained).toBe(false);
    expect(r.events).toBe(0);
  });

  it("ignores mains hum, which is periodic but not a voice", () => {
    const r = play([
      [ROOM, 3_000],
      [mix(ROOM, mainsHum(0.01)), 10_000],
    ]);
    expect(r.everSustained).toBe(false);
  });

  it("ignores typing", () => {
    const r = play([
      [ROOM, 3_000],
      [mix(ROOM, keyboard(0.3, 8, 3)), 15_000],
    ]);
    expect(r.everSustained).toBe(false);
    expect(r.events).toBe(0);
  });

  it("ignores a sudden burst of broadband noise (a door, a chair)", () => {
    const r = play([
      [ROOM, 3_000],
      [mix(ROOM, whiteNoise(0.05, 4)), 600],
      [ROOM, 3_000],
    ]);
    expect(r.everSustained).toBe(false);
  });

  it("hears someone talking at a normal level", () => {
    const r = play([
      [ROOM, 3_000],
      [mix(ROOM, voice(0.02)), 2_000],
    ]);
    expect(r.everSustained).toBe(true);
    expect(r.events).toBeGreaterThanOrEqual(1);
  });

  it("hears a higher voice too", () => {
    const r = play([
      [ROOM, 3_000],
      [mix(ROOM, voice(0.02, 220)), 2_000],
    ]);
    expect(r.everSustained).toBe(true);
  });

  it("hears talking over a fan", () => {
    const r = play([
      [mix(ROOM, fan(0.01, 5)), 5_000],
      [mix(ROOM, fan(0.01, 5), voice(0.03)), 2_000],
    ]);
    expect(r.everSustained).toBe(true);
  });

  it("does not count a single short word as someone talking", () => {
    const r = play([
      [ROOM, 3_000],
      [mix(ROOM, voice(0.02)), 500],
      [ROOM, 3_000],
    ]);
    expect(r.everSustained).toBe(false);
    expect(r.events).toBe(0);
  });

  it("does not flag anything while it is still learning the room", () => {
    const r = play([[mix(ROOM, voice(0.02)), DEFAULT_PROCTOR_CONFIG.audio.calibrationMs]]);
    expect(r.instantFrames).toBe(0);
  });
});

describe("recognisedWords", () => {
  it("needs at least two real words", () => {
    expect(recognisedWords("")).toBe(false);
    expect(recognisedWords(" uh ")).toBe(false);
    expect(recognisedWords("hmm")).toBe(false);
    expect(recognisedWords("what is the answer")).toBe(true);
    expect(recognisedWords("बताओ जवाब")).toBe(true);
  });
});
