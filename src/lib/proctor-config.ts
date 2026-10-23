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
  /** FFT size for the spectrum analyser (frequency bins = fftSize / 2). */
  fftSize: number;
  /**
   * FFT size for the second analyser whose waveform is used to find a voice
   * pitch. It must hold two periods of an 80 Hz voice: 2048 samples is 43 ms
   * at 48 kHz.
   */
  pitchFftSize: number;
  /** Time spent learning the room's level before anything can count as speech. */
  calibrationMs: number;
  /** Minimum graded speech score [0.0, 1.0]; the hard gates below must also all hold. */
  minSpeechProbability: number;
  /** Speech must be continuous this long to count — a word or a cough is not someone talking. */
  minSpeechDurationMs: number;
  /** Maximum pause duration in ms within continuous speech that gets merged into one utterance. */
  speechGapMergeMs: number;
  /** Cooldown in ms after an utterance ends before a new event can be raised. */
  eventCooldownMs: number;
  /** Speech-band floor reported before the first frame arrives. */
  noiseFloorInitial: number;
  /** Per-frame rate at which the speech-band floor falls to a quieter room. */
  noiseFloorTrackDownRate: number;
  /** Per-frame rate at which it rises to steadier, louder noise (slow, so a voice cannot drag it up). */
  noiseFloorTrackUpRate: number;
  /** dB the speech band must rise above its own floor. */
  minSnrDb: number;
  /** dB the speech band must sit above the keyboard-clatter band (4–8 kHz). */
  formantMinRatio: number;
  /** Maximum Spectral Flatness Measure for voiced speech (telemetry). */
  maxSpectralFlatness: number;
  /** Minimum autocorrelation peak at a voice pitch (80–400 Hz) for a frame to count as voiced. */
  minPeriodicity: number;
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
    headYawThresholdDeg: 16.0,
    headPitchDownThresholdDeg: 12.0,
    headPitchUpThresholdDeg: 14.0,
    headRollThresholdDeg: 18.0,
    irisYawThreshold: 0.22,
    irisPitchThreshold: 0.22,
    blinkEarThreshold: 0.18,
    blinkBlendshapeThreshold: 0.45,
    gazeSmoothingFactor: 0.35,
    minOffScreenDwellMs: 2000,
    gazeHysteresisReleaseMs: 1500,
    calibrationFrames: 5,
    maxLookingAwayStrikes: 5,
  },
  audio: {
    fftSize: 512,
    pitchFftSize: 2048,
    calibrationMs: 1500,
    minSpeechProbability: 0.55,
    minSpeechDurationMs: 800,
    speechGapMergeMs: 450,
    eventCooldownMs: 2000,
    noiseFloorInitial: 14,
    noiseFloorTrackDownRate: 0.15,
    noiseFloorTrackUpRate: 0.02,
    minSnrDb: 10,
    formantMinRatio: 6,
    maxSpectralFlatness: 0.52,
    minPeriodicity: 0.45,
    maxVoiceStrikes: 3,
  },
  objects: {
    phoneMinScore: 0.3,
    bookMinScore: 0.4,
    phoneActivateSeconds: 3,
  },
};
