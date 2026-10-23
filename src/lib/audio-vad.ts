/**
 * Voice activity detection for the proctor: is someone TALKING near the
 * student, as opposed to a fan, a keyboard, a chair or a quiet room?
 *
 * ---------------------------------------------------------------------------
 * What went wrong before, and why the design is what it is
 * ---------------------------------------------------------------------------
 * A student alone in a silent room had a test ended for "speaking". The old
 * detector set its noise floor from the average of the WHOLE spectrum — mostly
 * near-silent bins above 8 kHz — and then compared the 300 Hz–3 kHz speech band
 * against it. Room noise always sits higher in that band than the whole-band
 * average, so a quiet room measured several dB "above the noise floor", and
 * with high-frequency bins near zero it also looked "formant-heavy". A silent
 * room scored at the speech threshold; a car passing pushed it over.
 *
 * Now:
 *   1. The floor is the speech band's OWN level, learnt during a short
 *      calibration and then tracked (quickly down, slowly up). Steady noise —
 *      a fan, an AC, a laptop's whine — is absorbed into it and never counts.
 *   2. Levels are in decibels. getByteFrequencyData is already a dB scale
 *      (0–255 across the analyser's dB range), so "how far above the room" is a
 *      difference of bytes, not a ratio of them.
 *   3. Speech must be voiced: the time-domain signal must repeat at a pitch a
 *      human voice can have (80–400 Hz). Clicks, thuds, rustling and breathing
 *      do not; a voice does.
 *   4. It must be sustained (minSpeechDurationMs) before it counts at all.
 *
 * Every condition is a hard gate, so no single strong feature (a loud click,
 * a periodic hum) can carry a frame over the line on its own.
 */

import { DEFAULT_PROCTOR_CONFIG, type AudioVadConfig } from "@/lib/proctor-config";

export interface AudioFrameMetrics {
  /** Mean byte level across the whole spectrum (0–255), for the mic meter. */
  rmsEnergy: number;
  /** How far the speech band is above its own learnt floor, in dB. */
  snrDb: number;
  spectralFlatness: number;
  zeroCrossingRate: number;
  /** Speech band level minus keyboard-clatter band level, in dB. */
  formantRatio: number;
  /** Normalised autocorrelation peak at a voice pitch, 0–1. 1 when no waveform was given. */
  periodicity: number;
  speechProbability: number;
  isSpeechInstantaneous: boolean;
}

export interface SpeechEvent {
  id: string;
  startTimestamp: number;
  endTimestamp: number;
  durationMs: number;
  confidence: number;
  snrDb: number;
  peakProbability: number;
}

/** Frequency band edges in Hz. Bins are derived from these and the real sample rate. */
const BANDS = {
  /** Room hum, fans, mains. */
  humMaxHz: 200,
  /** Voiced speech: F1 to F3, where nearly all speech energy sits. */
  formantLowHz: 300,
  formantHighHz: 3_000,
  /** Keyboard clatter and clicks: above the speech formants. */
  clatterLowHz: 4_000,
  clatterHighHz: 8_000,
  /** Range over which spectral flatness is measured. */
  flatnessLowHz: 150,
  flatnessHighHz: 4_500,
} as const;

/** Human voice pitch range searched for in the waveform. */
const PITCH_MIN_HZ = 80;
const PITCH_MAX_HZ = 400;
/** Below this RMS (on a −1..1 scale) the waveform is too quiet to judge pitch. */
const MIN_WAVEFORM_RMS = 0.004;

/** The analyser's default decibel range (minDecibels −100, maxDecibels −30) spread over 0–255. */
const DB_PER_BYTE = 70 / 255;

interface BinRanges {
  humEnd: number;
  formantStart: number;
  formantEnd: number;
  clatterStart: number;
  clatterEnd: number;
  flatnessStart: number;
  flatnessEnd: number;
}

/**
 * Converts the Hz bands into FFT bin indices for this microphone.
 *
 * Each bin is sampleRate / fftSize Hz wide: 93.75 Hz at 48 kHz with a 512
 * FFT, 86.1 Hz at 44.1 kHz. bin = round(f × fftSize / sampleRate).
 */
export function binRanges(sampleRate: number, fftSize: number): BinRanges {
  const binCount = Math.floor(fftSize / 2);
  const bin = (hz: number) => Math.max(0, Math.min(binCount, Math.round((hz * fftSize) / sampleRate)));
  return {
    humEnd: Math.max(1, bin(BANDS.humMaxHz)),
    formantStart: bin(BANDS.formantLowHz),
    formantEnd: bin(BANDS.formantHighHz),
    clatterStart: bin(BANDS.clatterLowHz),
    clatterEnd: bin(BANDS.clatterHighHz),
    flatnessStart: Math.max(1, bin(BANDS.flatnessLowHz)),
    flatnessEnd: bin(BANDS.flatnessHighHz),
  };
}

function mean(data: Uint8Array, from: number, to: number): number {
  const end = Math.min(to, data.length);
  let sum = 0;
  let n = 0;
  for (let i = Math.max(0, from); i < end; i++) {
    sum += data[i];
    n++;
  }
  return n > 0 ? sum / n : 0;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Whether a speech-recogniser transcript holds real words: at least two with
 * letters in them, not a lone "uh" it made of a cough or a chair.
 */
export function recognisedWords(text: string): boolean {
  return text.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length >= 2;
}

export class AudioVadEngine {
  private config: AudioVadConfig;
  // Until configureSpectrum() is called, assume the most common laptop rate.
  private sampleRate = 48_000;
  private bins: BinRanges = binRanges(48_000, DEFAULT_PROCTOR_CONFIG.audio.fftSize);
  /** The speech band's own resting level, in bytes. Null until the first frame. */
  private formantFloor: number | null = null;
  private calibratedMs = 0;
  private activeSpeechStart: number | null = null;
  private lastSpeechEnd = 0;
  private consecutiveSpeechMs = 0;
  private consecutiveSilenceMs = 0;
  private currentEvent: SpeechEvent | null = null;
  private lastCooldownTimestamp = -100_000;

  constructor(config: AudioVadConfig = DEFAULT_PROCTOR_CONFIG.audio) {
    this.config = config;
  }

  public reset(): void {
    this.formantFloor = null;
    this.calibratedMs = 0;
    this.activeSpeechStart = null;
    this.lastSpeechEnd = 0;
    this.consecutiveSpeechMs = 0;
    this.consecutiveSilenceMs = 0;
    this.currentEvent = null;
    this.lastCooldownTimestamp = -100_000;
  }

  /** Sets the frequency bands for this microphone's sample rate and FFT size. */
  public configureSpectrum(sampleRate: number, fftSize: number): void {
    if (sampleRate > 0 && fftSize > 0) {
      this.sampleRate = sampleRate;
      this.bins = binRanges(sampleRate, fftSize);
    }
  }

  /** The learnt resting level of the speech band, in bytes (the config's initial value until calibrated). */
  public getNoiseFloor(): number {
    return this.formantFloor ?? this.config.noiseFloorInitial;
  }

  /**
   * Spectral Flatness Measure: geometric over arithmetic mean of power.
   * Near 1 for flat noise, lower for peaked (harmonic) spectra. Telemetry only.
   */
  public calculateSpectralFlatness(magnitudes: Uint8Array): number {
    let sum = 0;
    let logSum = 0;
    let count = 0;
    const endBin = Math.min(this.bins.flatnessEnd, magnitudes.length);
    for (let i = this.bins.flatnessStart; i < endBin; i++) {
      const p = Math.max(1e-4, Math.pow(magnitudes[i] / 255.0, 2));
      sum += p;
      logSum += Math.log(p);
      count++;
    }
    if (count === 0 || sum === 0) return 1.0;
    return clamp01(Math.exp(logSum / count) / (sum / count));
  }

  /** Zero-crossing rate of the time-domain buffer. Telemetry only. */
  public calculateZeroCrossingRate(timeDomain: Uint8Array): number {
    let crossings = 0;
    for (let i = 1; i < timeDomain.length; i++) {
      const prev = timeDomain[i - 1] - 128;
      const curr = timeDomain[i] - 128;
      if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) crossings++;
    }
    return crossings / Math.max(1, timeDomain.length - 1);
  }

  /**
   * How strongly the waveform repeats at a voice pitch (80–400 Hz): the peak
   * normalised autocorrelation over those lags, 0–1. Voiced speech is
   * typically above 0.5; noise, clicks and breath are well below. A buffer
   * too short to hold two pitch periods is judged on the lags it can hold.
   */
  public calculatePeriodicity(timeDomain: Uint8Array): number {
    const n = timeDomain.length;
    const x = new Float32Array(n);
    let energy = 0;
    for (let i = 0; i < n; i++) {
      x[i] = (timeDomain[i] - 128) / 128;
      energy += x[i] * x[i];
    }
    if (n === 0 || Math.sqrt(energy / n) < MIN_WAVEFORM_RMS) return 0;

    const minLag = Math.max(2, Math.floor(this.sampleRate / PITCH_MAX_HZ));
    const maxLag = Math.min(Math.floor(n / 2), Math.ceil(this.sampleRate / PITCH_MIN_HZ));
    let best = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let cross = 0;
      let a = 0;
      let b = 0;
      for (let i = 0; i + lag < n; i++) {
        cross += x[i] * x[i + lag];
        a += x[i] * x[i];
        b += x[i + lag] * x[i + lag];
      }
      const r = a > 0 && b > 0 ? cross / Math.sqrt(a * b) : 0;
      if (r > best) best = r;
    }
    return clamp01(best);
  }

  /**
   * Processes one analyser read. `timeDomainData` may be null (tests, or a
   * browser without it); the pitch gate is then skipped, not failed.
   */
  public processFrame(
    frequencyData: Uint8Array,
    timeDomainData: Uint8Array | null,
    nowMs: number,
    frameIntervalMs: number = 100,
  ): {
    metrics: AudioFrameMetrics;
    activeSpeech: boolean;
    /**
     * Speech has been sustained for at least minSpeechDurationMs without a
     * break. This — not a single loud frame — is what counts as someone
     * talking; it is what the proctor latches as a voice sighting.
     */
    sustainedSpeech: boolean;
    confirmedEvent: SpeechEvent | null;
  } {
    const { formantStart, formantEnd, clatterStart, clatterEnd, humEnd } = this.bins;
    const rawAvg = mean(frequencyData, 0, frequencyData.length);
    const avgFormant = mean(frequencyData, formantStart, formantEnd);
    const avgHigh = mean(frequencyData, clatterStart, clatterEnd);
    const lowHum = mean(frequencyData, 0, humEnd);

    // 1. The speech band's own floor. Calibrate fast, then track: quickly
    //    down when the room goes quieter, slowly up so a voice cannot drag it
    //    with it — but steady noise is absorbed within a few seconds.
    const calibrating = this.calibratedMs < this.config.calibrationMs;
    if (this.formantFloor === null) {
      this.formantFloor = avgFormant;
    } else if (calibrating) {
      this.formantFloor = this.formantFloor * 0.5 + avgFormant * 0.5;
    } else {
      const rate = avgFormant < this.formantFloor ? this.config.noiseFloorTrackDownRate : this.config.noiseFloorTrackUpRate;
      this.formantFloor += (avgFormant - this.formantFloor) * rate;
    }
    this.calibratedMs += frameIntervalMs;

    // 2. Levels in dB.
    const snrDb = Math.max(0, avgFormant - this.formantFloor) * DB_PER_BYTE;
    const formantOverClatterDb = (avgFormant - avgHigh) * DB_PER_BYTE;

    // 3. Voicing.
    const periodicity = timeDomainData ? this.calculatePeriodicity(timeDomainData) : 1;

    const spectralFlatness = this.calculateSpectralFlatness(frequencyData);
    const zeroCrossingRate = timeDomainData ? this.calculateZeroCrossingRate(timeDomainData) : 0;

    // Every gate must hold.
    const loudEnough = snrDb >= this.config.minSnrDb;
    const speechShaped = formantOverClatterDb >= this.config.formantMinRatio;
    const notHum = !(lowHum > 0 && avgFormant < lowHum * 0.7);
    const voiced = periodicity >= this.config.minPeriodicity;

    // A graded score for telemetry and the threshold; the gates decide.
    const speechScore = calibrating
      ? 0
      : clamp01(snrDb / (this.config.minSnrDb * 2)) * 0.5 +
        clamp01(formantOverClatterDb / (this.config.formantMinRatio * 2)) * 0.25 +
        clamp01((periodicity - 0.2) / 0.5) * 0.25;

    const isSpeechInstantaneous =
      !calibrating && loudEnough && speechShaped && notHum && voiced && speechScore >= this.config.minSpeechProbability;

    // 4. Sustained-speech filtering and short-gap merging.
    let confirmedEvent: SpeechEvent | null = null;

    if (isSpeechInstantaneous) {
      this.consecutiveSilenceMs = 0;
      this.consecutiveSpeechMs += frameIntervalMs;

      if (!this.activeSpeechStart) {
        this.activeSpeechStart =
          nowMs - this.lastSpeechEnd <= this.config.speechGapMergeMs && this.currentEvent
            ? this.currentEvent.startTimestamp
            : nowMs;
      }

      if (this.consecutiveSpeechMs >= this.config.minSpeechDurationMs && nowMs - this.lastCooldownTimestamp > this.config.eventCooldownMs) {
        this.currentEvent = {
          id: `speech_${Math.round(nowMs)}`,
          startTimestamp: this.activeSpeechStart,
          endTimestamp: nowMs,
          durationMs: nowMs - this.activeSpeechStart,
          confidence: Math.min(0.98, speechScore + 0.1),
          snrDb,
          peakProbability: speechScore,
        };
        confirmedEvent = this.currentEvent;
        this.lastCooldownTimestamp = nowMs;
      }
    } else {
      this.consecutiveSpeechMs = 0;
      this.consecutiveSilenceMs += frameIntervalMs;
      if (this.activeSpeechStart && this.consecutiveSilenceMs > this.config.speechGapMergeMs) {
        this.lastSpeechEnd = nowMs;
        this.activeSpeechStart = null;
      }
    }

    return {
      metrics: {
        rmsEnergy: rawAvg,
        snrDb,
        spectralFlatness,
        zeroCrossingRate,
        formantRatio: formantOverClatterDb,
        periodicity,
        speechProbability: speechScore,
        isSpeechInstantaneous,
      },
      activeSpeech: isSpeechInstantaneous || this.consecutiveSpeechMs >= this.config.minSpeechDurationMs,
      sustainedSpeech: this.consecutiveSpeechMs >= this.config.minSpeechDurationMs,
      confirmedEvent,
    };
  }
}
