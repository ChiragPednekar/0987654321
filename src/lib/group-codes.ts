/**
 * Group join codes.
 *
 * The code lives in `groups.join_code` (20250101000027), which carries a unique
 * index where the value is present. It used to be embedded in the group's
 * *description* as `[join_code:GRP-XXXX]` and looked up with
 * `ilike '%[join_code:…]%'`, which had three problems worth naming so nobody
 * reintroduces them:
 *
 *   1. No uniqueness. Two groups could generate the same code, and the lookup
 *      took whichever row came back first — so a code could silently admit you
 *      to somebody else's group.
 *   2. The description is readable by anyone who can see the group, and public
 *      groups are readable by everyone. A private group's code was therefore
 *      one page view away for anyone who happened to look.
 *   3. It was a substring match on free text. A description that merely
 *      mentioned the pattern would match.
 *
 * `cleanGroupDescription` and `extractGroupJoinCode` survive only to read the
 * groups created under the old scheme; nothing writes that format any more.
 */

/** Six unambiguous characters — no O/0 or I/1, because people read these aloud. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateGroupJoinCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Normalises whatever the user typed into the shape stored in the column.
 *
 * Accepts the legacy `GRP-` prefix so a code handed out under the old scheme
 * still works, and ignores spacing and case, because these are read aloud and
 * retyped.
 */
export function normaliseGroupJoinCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "").replace(/^GRP-/, "");
}

/** Legacy: a code embedded in the description by the old scheme. */
export function extractGroupJoinCode(
  description: string | null | undefined,
): string | null {
  if (!description) return null;
  const match = description.match(/\[join_code:([A-Z0-9-]+)\]/);
  return match ? match[1] : null;
}

/** Strips a legacy embedded code so the description reads as the user wrote it. */
export function cleanGroupDescription(
  description: string | null | undefined,
): string {
  if (!description) return "";
  return description.replace(/\[join_code:[A-Z0-9-]+\]/g, "").trim();
}
