"use client";

import * as React from "react";

/**
 * What a teacher has ticked in the library, waiting to be added to a batch.
 *
 * Module-level and mirrored to sessionStorage, so a selection survives moving
 * between library pages — tick three cases, two SQL exercises and a handful of
 * aptitude questions, then add them all at once — but is gone when the tab is
 * closed. One store for the whole app; the floating bar in the layout reads it
 * and every toggle on every list writes it.
 */

export type PickKind = "case" | "path" | "sql" | "excel" | "aptitude";

export interface PickedItem {
  kind: PickKind;
  id: string;
  title: string;
}

const KEY = "casecode:library-picks";
const EMPTY: PickedItem[] = [];
let picks: PickedItem[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as PickedItem[]) : [];
    if (Array.isArray(parsed)) picks = parsed;
  } catch {
    // Unreadable or blocked storage: start empty.
  }
}

function save(next: PickedItem[]) {
  picks = next;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Still works for this page; just will not survive a reload.
  }
  listeners.forEach((l) => l());
}

export function togglePick(item: PickedItem) {
  load();
  const exists = picks.some((p) => p.kind === item.kind && p.id === item.id);
  save(exists ? picks.filter((p) => !(p.kind === item.kind && p.id === item.id)) : [...picks, item]);
}

export function setPicks(next: PickedItem[]) {
  load();
  save(next);
}

export function clearPicks() {
  save(EMPTY);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): PickedItem[] {
  load();
  return picks;
}

/** Everything picked. Empty on the server and during hydration. */
export function usePicks(): PickedItem[] {
  return React.useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function useIsPicked(kind: PickKind, id: string): boolean {
  const all = usePicks();
  return all.some((p) => p.kind === kind && p.id === id);
}
