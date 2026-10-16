/**
 * Centralized, validated configuration for proctoring detection pipelines.
 *
 * All parameters are documented with physical units, empirical calibration
 * notes, and production defaults.
 */

export interface GazeTrackingConfig {
  /** Sampling interval for video frames in milliseconds. Mirrors SAMPLE_INTERVAL_MS in camera-proctor.ts. */
  sampleIntervalMs: number;
  /** Minimum MediaPipe model confidence for face detection. */
  minFaceDetectionConfidence: number;
  /** Minimum MediaPipe tracking confidence. */
  minTrackingConfidence: number;
  /** Horizontal head yaw threshold in degrees before triggering head turn suspicion. */
  headYawThresholdDeg: number;
  /** Vertical head pitch downwards (looking down at lap/notes) in degrees. */
  headPitchDownThresholdDeg: number;
  /** Vertical head pitch upwards (looking up at ceiling) in degrees. */
  headPitchUpThresholdDeg: number;
  /** Head roll tilt in degrees. */
  headRollThresholdDeg: number;
  /** Normalized iris horizontal deviation from resting center eye ratio [-1.0, 1.0]. */
  irisYawThreshold: number;
  /** Normalized iris vertical deviation from resting center. */
  irisPitchThreshold: number;
  /** Eye Aspect Ratio (EAR) below which an eye is considered closed or blinking. */
  blinkEarThreshold: number;
  /** Blendshape score above which eye is considered blinking (0.0 - 1.0). */
  blinkBlendshapeThreshold: number;
  /** Exponential Moving Average (EMA) smoothing weight for gaze angles (0.1 - 0.9). */
  gazeSmoothingFactor: number;
  /** Minimum dwell time in milliseconds of sustained off-screen gaze before confirming an event. */
  minOffScreenDwellMs: number;
  /** Time of normal gaze required to release an active off-screen condition (hysteresis). */
  gazeHysteresisReleaseMs: number;
  /** Number of frontal frames collected to compute candidate's resting posture baseline. */
  calibrationFrames: number;
  /** Benefit of doubt warnings for looking away before test suspension. */
  maxLookingAwayStrikes: number;
}

export interface AudioVadConfig {
  /** FFT size for Web Audio AnalyserNode (frequency bins = fftSize / 2). */
  fftSize: number;
  /** Minimum speech probability score [0.0, 1.0] to flag active speech. */
  minSpeechProbability: number;
  /** Minimum speech utterance duration in ms to filter isolated clicks, coughs, or thuds. */
  minSpeechDurationMs: number;
  /** Maximum pause duration in ms within continuous speech that gets merged into one utterance. */
  speechGapMergeMs: number;
  /** Cooldown in ms after an utterance ends before a new event can be raised. */
  eventCooldownMs: number;
  /** Initial ambient noise floor estimate. */
  noiseFloorInitial: number;
  /** Fast tracking downward rate for ambient noise floor during quiet periods. */
  noiseFloorTrackDownRate: number;
  /** Slow tracking upward rate to prevent speech from dragging the noise floor up. */
  noiseFloorTrackUpRate: number;
  /** Minimum SNR in dB above noise floor to consider speech candidates. */
  minSnrDb: number;
  /** Minimum speech formant energy (300Hz-2800Hz) ratio relative to high-frequency clatter (4000-8000Hz). */
  formantMinRatio: number;
  /** Maximum Spectral Flatness Measure (SFM) for voiced speech (noise/fans have high SFM > 0.5). */
  maxSpectralFlatness: number;
  /** Benefit of doubt warnings for speech before test suspension. */
  maxVoiceStrikes: number;
}

export interface ObjectDetectionConfig {
  phoneMinScore: number;
  bookMinScore: number;
  /** Seconds of sightings in the 7.5 s window that switch "phone" on (camera-proctor.ts works in time, not samples). */
  phoneActivateSeconds: number;
}

export interface ProctorEngineConfig {
  gaze: GazeTrackingConfig;
  audio: AudioVadConfig;
  objects: ObjectDetectionConfig;
}

export const DEFAULT_PROCTOR_CONFIG: ProctorEngineConfig = {
  gaze: {
    sampleIntervalMs: 750,
    minFaceDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    headYawThresholdDeg: 20.0,
    headPitchDownThresholdDeg: 14.0,
    headPitchUpThresholdDeg: 16.0,
    headRollThresholdDeg: 22.0,
    irisYawThreshold: 0.22,
    irisPitchThreshold: 0.22,
    blinkEarThreshold: 0.18,
    blinkBlendshapeThreshold: 0.45,
    gazeSmoothingFactor: 0.35,
    minOffScreenDwellMs: 3000,
    gazeHysteresisReleaseMs: 1500,
    calibrationFrames: 5,
    maxLookingAwayStrikes: 5,
  },
  audio: {
    fftSize: 512,
    minSpeechProbability: 0.55,
    minSpeechDurationMs: 350,
    speechGapMergeMs: 450,
    eventCooldownMs: 2000,
    noiseFloorInitial: 14,
    noiseFloorTrackDownRate: 0.15,
    noiseFloorTrackUpRate: 0.02,
    minSnrDb: 6.0,
    formantMinRatio: 1.2,
    maxSpectralFlatness: 0.52,
    maxVoiceStrikes: 3,
  },
  objects: {
    phoneMinScore: 0.3,
    bookMinScore: 0.4,
    phoneActivateSeconds: 3,
  },
};
