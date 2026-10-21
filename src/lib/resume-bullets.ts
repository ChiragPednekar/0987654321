/**
 * Picks the achievement bullets out of a résumé's plain text.
 *
 * Text from a résumé file is messy in two different ways:
 *   - Word files keep their bullet markers, but every heading, contact line and
 *     job title sits between them.
 *   - PDFs usually lose the markers (they are drawn as shapes, not characters)
 *     and break long bullets across lines, so "…recommending a 6%" and
 *     "price increase that was rolled out…" arrive as two lines.
 *
 * So: when the text has bullet markers, those lines are the bullets. When it
 * does not, a line counts as a bullet if it reads like one — a sentence of six
 * or more words that is not contact details and not a role/education line with
 * a date range. Either way, a line that starts in lower case continues the
 * bullet above it.
 *
 * The student sees every picked bullet in the box and edits before anything is
 * critiqued, so this aims to be useful, not perfect. Pure, so it is tested.
 */

const MARKER = /^\s*(?:[•●▪◦‣■□➢➤►✓✔*\-–—]|\d{1,2}[.)])\s*/;
const CONTACT = /@|https?:\/\/|www\.|linkedin\.com|github\.com|\+?\d[\d\s-]{8,}\d/i;
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE_RANGE = new RegExp(
  `(?:${MONTH}\\s*)?(?:19|20)?\\d{2,4}\\s*[–—-]\\s*(?:${MONTH}\\s*)?(?:(?:19|20)?\\d{2,4}|present|current|now)|${MONTH}\\s*[–—-]\\s*${MONTH}`,
  "i",
);

/** Upper bound on what is handed back; the box shows them all for editing. */
export const MAX_EXTRACTED_BULLETS = 30;

function words(line: string) {
  return line.split(/\s+/).filter(Boolean).length;
}

function clean(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function endsSentence(line: string) {
  return /[.!?;:]$/.test(line);
}

export function pickBullets(text: string): string[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\t/g, " "))
    .filter((l) => l.trim().length > 0);

  const marked = lines.filter((l) => MARKER.test(l) && clean(l.replace(MARKER, "")).length > 0);
  const useMarkers = marked.length >= 2;

  const bullets: string[] = [];
  let open = false; // the last bullet may still continue on the next line

  for (const raw of lines) {
    const hasMarker = MARKER.test(raw);
    const line = clean(hasMarker ? raw.replace(MARKER, "") : raw);
    if (!line) continue;

    // A wrapped continuation: lower-case start, right after a bullet that has
    // not finished its sentence.
    if (open && !hasMarker && /^[a-z(%&,]/.test(line) && !endsSentence(bullets[bullets.length - 1])) {
      bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${line}`;
      continue;
    }

    const isBullet = useMarkers
      ? hasMarker
      : words(line) >= 6 && !CONTACT.test(line) && !DATE_RANGE.test(line);

    if (isBullet) {
      bullets.push(line);
      open = true;
    } else {
      open = false;
    }
  }

  return bullets.slice(0, MAX_EXTRACTED_BULLETS);
}
