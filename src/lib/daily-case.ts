/**
 * The Daily Case.
 *
 * Picked deterministically from the date rather than stored, so every user
 * sees the same case on the same day, it needs no cron job to rotate, and it
 * cannot drift between the server rendering it and a client re-checking it.
 *
 * The window is UTC. A local-timezone window would mean two users in different
 * countries disagreeing about which case is "today's", and the countdown would
 * have to be computed per user.
 */

/** Days since the epoch, in UTC. Stable for the whole UTC day. */
export function utcDayIndex(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 86_400_000);
}

/**
 * Deterministic index into a list of length `count` for the given day.
 *
 * A plain `dayIndex % count` walks the catalogue in order, so consecutive days
 * would serve near-identical generated cases (they are seeded in blocks). The
 * hash spreads the sequence out instead.
 */
export function dailyIndex(count: number, now: Date = new Date()): number {
  if (count <= 0) return 0;

  let hash = utcDayIndex(now) * 2654435761; // Knuth's multiplicative constant
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822519);
  hash ^= hash >>> 13;

  return Math.abs(hash) % count;
}

/** Milliseconds until the next UTC midnight, for the reset countdown. */
export function msUntilReset(now: Date = new Date()): number {
  const next = (utcDayIndex(now) + 1) * 86_400_000;
  return Math.max(0, next - now.getTime());
}
