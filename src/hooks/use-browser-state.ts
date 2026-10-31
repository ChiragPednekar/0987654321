"use client";

import * as React from "react";

/**
 * Browser-only values without the "set state in an effect after mount" dance.
 *
 * The old pattern rendered once with a placeholder, then an effect called
 * setState with the real value, which rendered everything again. React's
 * useSyncExternalStore does the same job properly: the server snapshot is used
 * for the server render and for hydration (so the markup matches), and the
 * client snapshot takes over straight after, in one step.
 */

const noSubscribe = () => () => {};

/** True once running in the browser after hydration; false on the server. */
export function useIsClient(): boolean {
  return React.useSyncExternalStore(noSubscribe, () => true, () => false);
}

/**
 * A value only the browser can know — a feature check, say — and what to
 * render on the server until it is known. `read` must return a primitive (or
 * the same object each time), as useSyncExternalStore compares by identity.
 */
export function useBrowserValue<T>(read: () => T, serverValue: T): T {
  return React.useSyncExternalStore(noSubscribe, read, () => serverValue);
}

// ---- localStorage ------------------------------------------------------------

const listeners = new Set<() => void>();
/**
 * Values written this session, kept in memory as well, so a preference still
 * works for the visit when storage is unavailable (private windows, blocked
 * site data) — it just will not survive a reload.
 */
const memory = new Map<string, string>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed it.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readStored(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) return value;
  } catch {
    // Storage blocked: fall through to this session's memory.
  }
  return memory.get(key) ?? null;
}

/** Writes a stored value and re-renders every component reading it. */
export function writeStored(key: string, value: string): boolean {
  memory.set(key, value);
  let persisted = true;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    persisted = false;
  }
  listeners.forEach((l) => l());
  return persisted;
}

/** Deletes a stored value and re-renders every component reading it. */
export function removeStored(key: string): void {
  memory.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage blocked: the in-memory copy is already gone.
  }
  listeners.forEach((l) => l());
}

/** The stored string for `key`, or null — always null on the server. */
export function useStored(key: string): string | null {
  return React.useSyncExternalStore(
    subscribe,
    () => readStored(key),
    () => null,
  );
}

/**
 * Reads a stored value once, outside React's render cycle — for seeding
 * editable state such as a saved draft. Null on the server or when absent.
 */
export function readStoredOnce(key: string): string | null {
  if (typeof window === "undefined") return null;
  return readStored(key);
}

/**
 * A browser value that changes with time — a countdown, say — re-read every
 * `intervalMs`. `read` must return the same primitive until it really
 * changes (whole seconds, not milliseconds), or React re-renders in a loop.
 * `serverValue` is rendered until hydration, so the server and client agree.
 */
export function useTicking<T>(read: () => T, intervalMs: number, serverValue: T): T {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const timer = setInterval(onChange, intervalMs);
      return () => clearInterval(timer);
    },
    [intervalMs],
  );
  return React.useSyncExternalStore(subscribe, read, () => serverValue);
}
