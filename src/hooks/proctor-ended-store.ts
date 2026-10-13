"use client";

import * as React from "react";
import type { EndReason } from "@/lib/camera-proctor";

/**
 * Which test on this page the camera has ended, if any.
 *
 * A tiny store rather than state on each surface, because there are twelve
 * proctored surfaces and each has its own early returns — a results screen, a
 * loading state, a gate. An ended screen added to each by hand would be
 * missing from one of them. Instead useProctor writes here and one
 * ProctorEndedHost in the root layout reads it, so every surface is covered,
 * including the next one written.
 */
export interface EndedTest {
  reason: EndReason;
  at: string;
  /**
   * When the page opens again; null when it never will. Undefined until the
   * server has answered — the freeze does not wait for it.
   */
  until?: string | null;
  strike?: number;
  maxStrikes?: number;
}

let current: EndedTest | null = null;
const listeners = new Set<() => void>();

export function setEndedTest(next: EndedTest | null) {
  current = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useEndedTest(): EndedTest | null {
  return React.useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
