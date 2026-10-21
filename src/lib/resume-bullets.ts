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
 * And a skills section often uses the same markers ("• Prompt Engineering",
 * or "Python • SQL • Tableau" on one line), so a marker alone proves nothing.
 *
 * So every line is judged on what it says: a bullet reads like an achievement
 * — four or more words after a marker, six or more without one — and is not
 * contact details, not a role/education line with a date range, and not a
 * list of short skills. A line that starts in lower case continues the bullet
 * above it, which rejoins what a PDF wrapped.
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

/**
 * A skills row rather than a sentence: several short items joined by commas,
 * bullets or pipes ("Python, SQL, Tableau, Power BI"), or a dangling marker
 * left by a PDF that wrapped such a row ("Product Engineering •").
 */
function isSkillsList(line: string) {
  if (/[•●▪|·]\s*$/.test(line)) return true;
  const parts = line.split(/\s*[,•●▪|·;]\s*/).filter(Boolean);
  if (parts.length < 3) return false;
  const avgWords = parts.reduce((s, p) => s + words(p), 0) / parts.length;
  return avgWords <= 2.5;
}

export function pickBullets(text: string): string[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\t/g, " "))
    .filter((l) => l.trim().length > 0);

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

    const isBullet =
      words(line) >= (hasMarker ? 4 : 6) && !CONTACT.test(line) && !DATE_RANGE.test(line) && !isSkillsList(line);

    if (isBullet) {
      bullets.push(line);
      open = true;
    } else {
      open = false;
    }
  }

  return bullets.slice(0, MAX_EXTRACTED_BULLETS);
}
