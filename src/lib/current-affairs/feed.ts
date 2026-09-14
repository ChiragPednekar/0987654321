/**
 * Reading official press releases into source items.
 *
 * Pure: no network, no database. The cron fetches the XML and hands it here,
 * which is what lets tests/current-affairs.test.ts pin the parser to a captured
 * copy of the real feed.
 *
 * WHY ONLY THE RBI, FOR NOW
 *
 * A question can only be as trustworthy as the text it was written from, so a
 * source is usable only if its feed carries the release itself. The RBI's does:
 * each item's description is the full press release. SEBI's feed carries a
 * title and a link to a PDF, and PIB's refuses automated requests outright —
 * neither gives the model anything to be grounded in. Adding a source means
 * adding a parser here that returns real body text, not a headline.
 */

export type SourceKey = "rbi";

export const SOURCES: Record<SourceKey, { label: string; feedUrl: string }> = {
  rbi: {
    label: "Reserve Bank of India",
    feedUrl: "https://www.rbi.org.in/pressreleases_rss.xml",
  },
};

export interface SourceItem {
  source: SourceKey;
  url: string;
  title: string;
  /** ISO timestamp. */
  publishedAt: string;
  body: string;
}

/** Enough for any real press release; a bound on what one item costs in the prompt. */
export const MAX_BODY_CHARS = 6000;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rupee: "₹",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Press-release HTML to plain paragraphs. Table cells become spaced text rather than vanishing. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|tr|h\d|div)>/gi, "\n")
      .replace(/<\/t[dh]>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function field(item: string, tag: string): string | null {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return null;
  const inner = match[1].trim();
  const cdata = inner.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdata ? cdata[1] : decodeEntities(inner);
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * "Fri, 11 Sep 2026 21:40:00", with no zone. The RBI publishes in IST, and
 * reading it as UTC would put an evening release on the next day's quiz.
 */
export function parseFeedDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\s+([a-z]{3})[a-z]*,?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(.*)$/i);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined) return null;
  const [day, year, hh, mm, ss] = [m[1], m[3], m[4] ?? "0", m[5] ?? "0", m[6] ?? "0"].map(Number);
  const zone = m[7]?.trim();
  const offsetMinutes = /^[+-]\d{4}$/.test(zone ?? "")
    ? (zone![0] === "-" ? -1 : 1) * (Number(zone!.slice(1, 3)) * 60 + Number(zone!.slice(3)))
    : /^(gmt|utc|z)$/i.test(zone ?? "")
      ? 0
      : 330;
  const utc = Date.UTC(year, month, day, hh, mm, ss) - offsetMinutes * 60_000;
  return new Date(utc).toISOString();
}

export function parseRbiFeed(xml: string): SourceItem[] {
  const items: SourceItem[] = [];
  for (const [, raw] of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const title = htmlToText(field(raw, "title") ?? "");
    const url = (field(raw, "link") ?? "").trim();
    const publishedAt = parseFeedDate(field(raw, "pubDate") ?? "");
    const body = htmlToText(field(raw, "description") ?? "").slice(0, MAX_BODY_CHARS);
    if (!title || !/^https:\/\/(www\.)?rbi\.org\.in\//i.test(url) || !publishedAt) continue;
    items.push({ source: "rbi", url, title, publishedAt, body });
  }
  return items;
}

/**
 * Releases that are data, not news.
 *
 * Auction results, liquidity operations and statistical supplements are
 * published every day and would make a quiz of "what was the cut-off yield on
 * Tuesday" — true, and useless in an interview. They stay in the table, since
 * they cost nothing, but are never offered to the model.
 */
const ROUTINE = [
  /\bauction\b/i,
  /treasury bills?/i,
  /cut-?off/i,
  /\bresults?\b/i,
  /money supply/i,
  /reserve money/i,
  /statistical supplement/i,
  /money market operations/i,
  /\b(variable rate|reverse repo|vrrr?|vrr)\b/i,
  /reference rate/i,
  /lending and deposit rates/i,
  /sectoral deployment/i,
  /forex reserves?|foreign exchange reserves?/i,
  /state government securities/i,
];

/** Real, but narrow: a named small lender's penalty or restriction. Used only when nothing better exists. */
const LOW_VALUE = [
  /monetary penalty/i,
  /section 35a/i,
  /cancels? (the )?(certificate|licen[cs]e)/i,
  /directions under/i,
  /\bcompounding\b/i,
];

/** Too short to write a question from without guessing. */
export const MIN_BODY_CHARS = 350;

export function isRoutine(item: Pick<SourceItem, "title" | "body">): boolean {
  return item.body.length < MIN_BODY_CHARS || ROUTINE.some((re) => re.test(item.title));
}

/** Higher is better. Routine items never reach this. */
export function newsworthiness(item: Pick<SourceItem, "title" | "publishedAt">): number {
  return LOW_VALUE.some((re) => re.test(item.title)) ? 0 : 1;
}
