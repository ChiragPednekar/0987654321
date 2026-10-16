/**
 * Advanced Voice Activity Detection (VAD) & Audio Signal Processing Engine
 *
 * Implements:
 * 1. Multi-feature speech classification (Formants, Spectral Flatness, Autocorrelation, ZCR)
 * 2. Asymmetric dual-rate adaptive noise floor estimation
 * 3. Impulse and transient noise rejection (keyboard typing, mouse clicks, object impacts)
 * 4. Stationary noise filtering (fans, air conditioning, computer hum)
 * 5. Temporal speech burst filtering (minimum utterance duration)
 * 6. Short-gap pause merging (prevents splitting conversational sentences into multiple events)
 * 7. Event cooldown and timestamped telemetry with explainable confidence and SNR metrics
 */

import { DEFAULT_PROCTOR_CONFIG, type AudioVadConfig } from "@/lib/proctor-config";

export interface AudioFrameMetrics {
  rmsEnergy: number;
  snrDb: number;
  spectralFlatness: number;
  zeroCrossingRate: number;
  formantRatio: number;
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
 * FFT, 86.1 Hz at 44.1 kHz. The bands used to be hard-coded bin numbers that
 * only matched one rate — at 48 kHz "speech" stopped at 1.7 kHz, losing F2 and
 * F3, and "clatter" began at 2.25 kHz, right inside many voices, so speech was
 * scored as keyboard noise. bin = round(f × fftSize / sampleRate).
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

export class AudioVadEngine {
  private config: AudioVadConfig;
  // Until configureSpectrum() is called, assume the most common laptop rate.
  private bins: BinRanges = binRanges(48_000, DEFAULT_PROCTOR_CONFIG.audio.fftSize);
  private noiseFloor: number;
  private activeSpeechStart: number | null = null;
  private lastSpeechEnd: number = 0;
  private consecutiveSpeechMs = 0;
  private consecutiveSilenceMs = 0;
  private currentEvent: SpeechEvent | null = null;
  private eventHistory: SpeechEvent[] = [];
  private lastCooldownTimestamp = -100_000;

  constructor(config: AudioVadConfig = DEFAULT_PROCTOR_CONFIG.audio) {
    this.config = config;
    this.noiseFloor = config.noiseFloorInitial;
  }

  public reset(): void {
    this.noiseFloor = this.config.noiseFloorInitial;
    this.activeSpeechStart = null;
    this.lastSpeechEnd = 0;
    this.consecutiveSpeechMs = 0;
    this.consecutiveSilenceMs = 0;
    this.currentEvent = null;
    this.eventHistory = [];
    this.lastCooldownTimestamp = -100_000;
  }

  /** Sets the frequency bands for this microphone's sample rate and FFT size. */
  public configureSpectrum(sampleRate: number, fftSize: number): void {
    if (sampleRate > 0 && fftSize > 0) this.bins = binRanges(sampleRate, fftSize);
  }

  public getNoiseFloor(): number {
    return this.noiseFloor;
  }

  /**
   * Calculates Spectral Flatness Measure (SFM) from frequency magnitude data.
   * SFM = GeometricMean(Power) / ArithmeticMean(Power)
   * Values near 1.0 indicate flat white noise or clicks; values near 0.1-0.4 indicate harmonic speech.
   */
  public calculateSpectralFlatness(magnitudes: Uint8Array): number {
    let sum = 0;
    let logSum = 0;
    let count = 0;
    const startBin = this.bins.flatnessStart; // ~150 Hz
    const endBin = Math.min(this.bins.flatnessEnd, magnitudes.length); // ~4.5 kHz

    for (let i = startBin; i < endBin; i++) {
      const p = Math.max(1e-4, Math.pow(magnitudes[i] / 255.0, 2));
      sum += p;
      logSum += Math.log(p);
      count++;
    }

    if (count === 0 || sum === 0) return 1.0;
    const geometricMean = Math.exp(logSum / count);
    const arithmeticMean = sum / count;
    return Math.max(0.0, Math.min(1.0, geometricMean / arithmeticMean));
  }

  /**
   * Calculates zero-crossing rate from time-domain audio buffer.
   */
  public calculateZeroCrossingRate(timeDomain: Uint8Array): number {
    let crossings = 0;
    for (let i = 1; i < timeDomain.length; i++) {
      const prev = timeDomain[i - 1] - 128;
      const curr = timeDomain[i] - 128;
      if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
        crossings++;
      }
    }
    return crossings / Math.max(1, timeDomain.length - 1);
  }

  /**
   * Processes a frequency & time-domain frame from AnalyserNode.
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
    // 1. RMS / Average Energy
    let totalEnergy = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      totalEnergy += frequencyData[i];
    }
    const rawAvg = frequencyData.length > 0 ? totalEnergy / frequencyData.length : 0;

    // 2. Frequency Band Power Breakdown (bins from the real sample rate)
    // Speech formants: ~300 Hz to ~3 kHz
    const { formantStart, formantEnd, clatterStart, clatterEnd, humEnd } = this.bins;
    let formantEnergy = 0;
    let formantBins = 0;
    for (let i = formantStart; i < Math.min(formantEnd, frequencyData.length); i++) {
      formantEnergy += frequencyData[i];
      formantBins++;
    }
    const avgFormant = formantBins > 0 ? formantEnergy / formantBins : 0;

    // High frequency clatter / typing clicks: ~4 kHz to ~8 kHz
    let highEnergy = 0;
    let highBins = 0;
    for (let i = clatterStart; i < Math.min(clatterEnd, frequencyData.length); i++) {
      highEnergy += frequencyData[i];
      highBins++;
    }
    const avgHigh = highBins > 0 ? highEnergy / highBins : 0;

    // Sub-bass rumble (fans, AC, room hum): below ~200 Hz
    let humEnergy = 0;
    const humBins = Math.min(humEnd, frequencyData.length);
    for (let i = 0; i < humBins; i++) humEnergy += frequencyData[i];
    const lowHum = humBins > 0 ? humEnergy / humBins : 0;

    // 3. Asymmetric Dual-Rate Adaptive Noise Floor Tracking
    // When environment is quieter than floor, adapt down quickly.
    // When environment is louder, adapt up very slowly to avoid voice dragging floor up.
    if (rawAvg < this.noiseFloor) {
      this.noiseFloor = this.noiseFloor * (1 - this.config.noiseFloorTrackDownRate) + rawAvg * this.config.noiseFloorTrackDownRate;
    } else {
      this.noiseFloor = this.noiseFloor * (1 - this.config.noiseFloorTrackUpRate) + rawAvg * this.config.noiseFloorTrackUpRate;
    }
    // Floor lower bound
    this.noiseFloor = Math.max(8.0, this.noiseFloor);

    // 4. Signal-to-Noise Ratio (SNR) in dB
    const snrLinear = Math.max(1.0, avgFormant / Math.max(1.0, this.noiseFloor));
    const snrDb = 20.0 * Math.log10(snrLinear);

    // 5. Spectral Flatness & Zero-Crossing
    const spectralFlatness = this.calculateSpectralFlatness(frequencyData);
    const zeroCrossingRate = timeDomainData ? this.calculateZeroCrossingRate(timeDomainData) : 0.2;

    // 6. Formant Energy Ratio
    const formantRatio = avgHigh > 0 ? avgFormant / Math.max(1.0, avgHigh) : 1.5;

    // 7. Human Speech Acoustic Probability Score (0.0 to 1.0)
    // Criteria:
    // a) High formant energy relative to noise floor
    // b) Formant ratio dominates high-frequency typing rattle (formantRatio > 1.15)
    // c) Not pure stationary hum (avgFormant > lowHum * 0.7)
    // d) Spectral flatness is lower than flat noise threshold (SFM < 0.52)
    // e) Zero-crossing rate is in typical human voice range (0.04 - 0.45)
    let speechScore = 0.0;

    if (snrDb >= this.config.minSnrDb && avgFormant > 18.0) {
      const snrFactor = Math.min(1.0, Math.max(0.0, (snrDb - this.config.minSnrDb) / 12.0));
      const formantFactor = Math.min(1.0, Math.max(0.0, (formantRatio - 1.0) / 1.5));
      const flatnessFactor = Math.min(1.0, Math.max(0.0, (0.60 - spectralFlatness) / 0.35));
      const zcrFactor = zeroCrossingRate >= 0.03 && zeroCrossingRate <= 0.48 ? 1.0 : 0.5;

      speechScore = snrFactor * 0.4 + formantFactor * 0.3 + flatnessFactor * 0.2 + zcrFactor * 0.1;

      // c) Not pure stationary hum (avgFormant > lowHum * 0.7)
      if (lowHum > 0 && avgFormant < lowHum * 0.7) {
        speechScore *= 0.5;
      }
    }

    const isSpeechInstantaneous = speechScore >= this.config.minSpeechProbability;

    // 8. Temporal Burst Filtering & Short-Gap Merging
    let confirmedEvent: SpeechEvent | null = null;

    if (isSpeechInstantaneous) {
      this.consecutiveSilenceMs = 0;
      this.consecutiveSpeechMs += frameIntervalMs;

      if (!this.activeSpeechStart) {
        // Check if this is a continuation of previous utterance within gap merge window
        if (nowMs - this.lastSpeechEnd <= this.config.speechGapMergeMs && this.currentEvent) {
          this.activeSpeechStart = this.currentEvent.startTimestamp;
        } else {
          this.activeSpeechStart = nowMs;
        }
      }

      // Check if minimum duration requirement is met
      if (this.consecutiveSpeechMs >= this.config.minSpeechDurationMs) {
        const duration = nowMs - this.activeSpeechStart;
        // Check cooldown
        if (nowMs - this.lastCooldownTimestamp > this.config.eventCooldownMs) {
          this.currentEvent = {
            id: `speech_${Math.round(nowMs)}`,
            startTimestamp: this.activeSpeechStart,
            endTimestamp: nowMs,
            durationMs: duration,
            confidence: Math.min(0.98, speechScore + 0.1),
            snrDb,
            peakProbability: speechScore,
          };
          confirmedEvent = this.currentEvent;
          this.lastCooldownTimestamp = nowMs;
        }
      }
    } else {
      this.consecutiveSpeechMs = 0;
      this.consecutiveSilenceMs += frameIntervalMs;

      if (this.activeSpeechStart) {
        // Wait until gap merge threshold elapses before finalizing utterance
        if (this.consecutiveSilenceMs > this.config.speechGapMergeMs) {
          this.lastSpeechEnd = nowMs;
          this.activeSpeechStart = null;
        }
      }
    }

    return {
      metrics: {
        rmsEnergy: rawAvg,
        snrDb,
        spectralFlatness,
        zeroCrossingRate,
        formantRatio,
        speechProbability: speechScore,
        isSpeechInstantaneous,
      },
      activeSpeech: isSpeechInstantaneous || this.consecutiveSpeechMs >= this.config.minSpeechDurationMs,
      sustainedSpeech: this.consecutiveSpeechMs >= this.config.minSpeechDurationMs,
      confirmedEvent,
    };
  }
}
