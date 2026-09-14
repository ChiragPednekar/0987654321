/**
 * Every number in a piece of text, normalised so "1,20,000", "120,000" and
 * "120000" compare equal and "3.0" equals "3".
 *
 * Shared by the two places that refuse a figure the source never gave: resume
 * rewrites (src/lib/resume.ts) and current-affairs answers
 * (src/lib/current-affairs/questions.ts).
 */
export function numbersIn(text: string): string[] {
  const found = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return found.map(normaliseNumber);
}

export function normaliseNumber(raw: string): string {
  return raw.replace(/,/g, "").replace(/\.0+$/, "");
}

const WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
};

/**
 * Digits and simple number words together, so "Four" and "three tranches"
 * compare as 4 and 3.
 *
 * Only for checking facts against a source. Not used on resume rewrites, where
 * "one of the" is prose rather than a claim.
 */
export function quantitiesIn(text: string): string[] {
  const words = (text.toLowerCase().match(/[a-z]+/g) ?? [])
    .filter((w) => w in WORDS)
    .map((w) => String(WORDS[w]));
  return [...numbersIn(text), ...words];
}
