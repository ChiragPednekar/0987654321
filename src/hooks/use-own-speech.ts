"use client";

import * as React from "react";

/**
 * Transcribes this browser's own microphone.
 *
 * ---------------------------------------------------------------------------
 * Why each participant transcribes themselves
 * ---------------------------------------------------------------------------
 * Scoring a group discussion means knowing who said what. The usual approach —
 * record the room and diarise afterwards — is expensive, slow, and least
 * reliable exactly when it matters, which is when two people speak at once.
 *
 * Here every participant's own device transcribes only its own microphone, and
 * posts the text under its own authenticated session. Attribution is therefore
 * established by construction rather than inferred, and cannot be wrong.
 *
 * ---------------------------------------------------------------------------
 * The cost of that choice
 * ---------------------------------------------------------------------------
 * The Web Speech API is not universal. It works in Chrome and Edge, is absent
 * in Firefox, and is unreliable in Safari. `supported` reports this honestly so
 * the room can tell the student before the discussion starts, and so the
 * grading route can record "we could not hear you" instead of "you said
 * nothing" — which are opposite statements about a student and must never be
 * collapsed.
 */

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
}

function getRecogniser(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useOwnSpeech(
  active: boolean,
  onUtterance: (text: string) => void,
) {
  const [supported] = React.useState(() => getRecogniser() !== null);
  const [listening, setListening] = React.useState(false);
  const callbackRef = React.useRef(onUtterance);
  callbackRef.current = onUtterance;

  React.useEffect(() => {
    if (!active || !supported) return;
    const Recogniser = getRecogniser();
    if (!Recogniser) return;

    const recogniser = new Recogniser();
    recogniser.continuous = true;
    recogniser.interimResults = false;
    // Indian English. The accent models differ enough that en-US materially
    // mis-transcribes Indian speakers, and a mis-transcribed contribution is
    // marked as if it were said that way.
    recogniser.lang = "en-IN";

    let stopped = false;

    recogniser.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        // Interim results are dropped: only a finalised phrase is posted, so
        // the transcript is not full of half-sentences the speaker corrected.
        if (!result.isFinal) continue;
        const text = result[0].transcript.trim();
        if (text) callbackRef.current(text);
      }
    };

    recogniser.onerror = (event) => {
      // "no-speech" and "aborted" fire routinely during a pause and are not
      // failures. Anything else and we stop trying rather than spinning.
      if (event.error !== "no-speech" && event.error !== "aborted") {
        stopped = true;
        setListening(false);
      }
    };

    // The API stops itself after a silence even with `continuous` set, which
    // would silently end transcription part-way through a ten-minute
    // discussion. Restart until the room says otherwise.
    recogniser.onend = () => {
      if (stopped) return;
      try {
        recogniser.start();
      } catch {
        setListening(false);
      }
    };

    try {
      recogniser.start();
      setListening(true);
    } catch {
      setListening(false);
    }

    return () => {
      stopped = true;
      setListening(false);
      try {
        recogniser.stop();
      } catch {
        // Already stopped.
      }
    };
  }, [active, supported]);

  return { supported, listening };
}
