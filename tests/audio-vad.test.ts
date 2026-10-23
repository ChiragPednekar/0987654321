import { describe, expect, it } from "vitest";
import { AudioVadEngine, binRanges } from "@/lib/audio-vad";

const FFT = 512;
const BINS = FFT / 2;

/** A spectrum with `value` in [fromHz, toHz) and `floor` everywhere else, at this sample rate. */
function spectrum(sampleRate: number, bands: { fromHz: number; toHz: number; value: number; comb?: boolean }[], floor = 10) {
  const data = new Uint8Array(BINS).fill(floor);
  const hz = (i: number) => (i * sampleRate) / FFT;
  for (let i = 0; i < BINS; i++) {
    for (const b of bands) {
      if (hz(i) >= b.fromHz && hz(i) < b.toHz) {
        // Voiced speech is harmonic: alternate peaks and troughs, not a flat block.
        data[i] = b.comb && i % 2 === 1 ? Math.round(b.value / 4) : b.value;
      }
    }
  }
  return data;
}

/** Feeds frames 100 ms apart; returns the last result. */
function feed(vad: AudioVadEngine, frame: Uint8Array, count: number, startMs = 0) {
  let last = vad.processFrame(frame, null, startMs, 100);
  for (let i = 1; i < count; i++) last = vad.processFrame(frame, null, startMs + i * 100, 100);
  return last;
}

/** A voice whose energy sits mostly between 1.8 and 3 kHz — F2/F3, typical of higher voices. */
const higherVoice = (rate: number) =>
  spectrum(rate, [
    { fromHz: 300, toHz: 1_800, value: 90, comb: true },
    { fromHz: 1_800, toHz: 3_000, value: 170, comb: true },
  ]);

describe("binRanges", () => {
  it("follows the real sample rate", () => {
    const at48 = binRanges(48_000, FFT); // 93.75 Hz per bin
    expect(at48.formantEnd).toBe(32); // 3 kHz, not the old hard-coded 18 (1.7 kHz)
    expect(at48.clatterStart).toBe(43); // 4 kHz, not the old 24 (2.25 kHz)
    const at44 = binRanges(44_100, FFT); // 86.1 Hz per bin
    expect(at44.formantEnd).toBe(35);
    expect(at44.clatterStart).toBe(46);
  });
});

describe("AudioVadEngine", () => {
  for (const rate of [48_000, 44_100]) {
    it(`hears a higher voice as speech at ${rate / 1000} kHz, not as keyboard clatter`, () => {
      const vad = new AudioVadEngine();
      vad.configureSpectrum(rate, FFT);
      feed(vad, spectrum(rate, []), 20); // learn a quiet room (calibration is 1.5 s)
      const r = feed(vad, higherVoice(rate), 9, 2_000);
      expect(r.metrics.isSpeechInstantaneous).toBe(true);
      // With the old fixed bins this voice's upper formants were counted as
      // keyboard clatter. Keep a margin.
      expect(r.metrics.speechProbability).toBeGreaterThan(0.8);
      expect(r.sustainedSpeech).toBe(true);
    });
  }

  it("does not call keyboard clatter speech", () => {
    const vad = new AudioVadEngine();
    vad.configureSpectrum(48_000, FFT);
    feed(vad, spectrum(48_000, []), 20);
    const typing = spectrum(48_000, [{ fromHz: 4_000, toHz: 8_000, value: 160 }], 20);
    expect(feed(vad, typing, 20, 2_000).sustainedSpeech).toBe(false);
  });

  it("needs sustained speech — one loud frame (a cough, a thud) is not someone talking", () => {
    const vad = new AudioVadEngine();
    vad.configureSpectrum(48_000, FFT);
    feed(vad, spectrum(48_000, []), 20);
    const single = vad.processFrame(higherVoice(48_000), null, 2_000, 100);
    expect(single.sustainedSpeech).toBe(false);
    // Half a second is a word, not a conversation.
    expect(feed(vad, higherVoice(48_000), 4, 2_100).sustainedSpeech).toBe(false);
    // 900 ms in all is past the 800 ms minimum.
    expect(feed(vad, higherVoice(48_000), 4, 2_500).sustainedSpeech).toBe(true);
  });
});
