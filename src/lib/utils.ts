import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatPercent(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

/** "2h 15m", "45m", "30s" */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

/** "just now", "3h ago", "12 Mar" */
export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

/**
 * "19 Oct", or "19 Oct 2027" outside the current year — day before month, as
 * dates are read in India. Pinned to IST so a server render in UTC and the
 * browser agree on the day near midnight.
 */
export function formatDay(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "Asia/Kolkata",
  });
}

/** "19 Oct, 5:30 pm" — formatDay with the time, in IST. */
export function formatDayTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  return `${formatDay(d)}, ${time}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/**
 * First and last initial: "Chirag Yogesh Pednekar" → "CP", "Asha" → "A".
 * The first two words gave "CY" for anyone with a middle name, and the
 * leaderboard and Settings disagreed about who you were.
 */
export function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]!;
  const last = words.length > 1 ? words[words.length - 1]! : "";
  return (Array.from(first)[0]! + (last ? Array.from(last)[0]! : "")).toUpperCase();
}

/**
 * The tint an avatar without a photo takes, picked from the user's id so the
 * same person is the same colour on every page.
 */
export const AVATAR_TONES = ["brand", "info", "success", "highlight", "warning", "danger"] as const;
export type AvatarTone = (typeof AVATAR_TONES)[number];

export function avatarTone(id: string | null | undefined): AvatarTone {
  let hash = 0;
  for (const ch of id ?? "") hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

/** Rough token estimate — good enough for guarding a context window. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * "1 student", "2 students" — a count with a correctly pluralised noun.
 *
 * Every count in the interface was written as `{n} students`, which is right
 * exactly when n is not 1. A teacher with one student read "1 students across
 * 2 batches" on their own dashboard, and a batch card read "1 students". Small,
 * but it is the first screen a paying institution sees.
 *
 * Pass `plural` for nouns English does not pluralise with a bare "s".
 */
export function plural(count: number, noun: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? noun : (pluralForm ?? `${noun}s`)}`;
}
