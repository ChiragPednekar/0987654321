/**
 * Shared vocabulary for company prep.
 *
 * Free of `server-only`: the report form in the browser and the route's Zod
 * schema read the same round list and limits.
 */

export const COMPANY_SECTORS = [
  "Consulting",
  "FMCG",
  "Banking & finance",
  "Technology",
  "Conglomerate",
] as const;
export type CompanySector = (typeof COMPANY_SECTORS)[number];

export const INTERVIEW_ROUNDS = [
  "online_test",
  "group_discussion",
  "case_interview",
  "technical",
  "personal_interview",
  "hr",
  "other",
] as const;
export type InterviewRound = (typeof INTERVIEW_ROUNDS)[number];

export const ROUND_LABEL: Record<InterviewRound, string> = {
  online_test: "Online test",
  group_discussion: "Group discussion",
  case_interview: "Case interview",
  technical: "Technical / domain",
  personal_interview: "Personal interview",
  hr: "HR",
  other: "Other",
};

export const REPORT_LIMITS = {
  minQuestion: 15,
  maxQuestion: 1000,
  maxRole: 80,
  perDay: 5,
  earliestYear: 2018,
} as const;

export interface CompanyRound {
  name: string;
  detail: string;
}

export interface PracticeLink {
  label: string;
  href: string;
  why: string;
}

/**
 * Something the firm publishes itself for candidates — its interview page, a
 * practice case it wrote, its own assessment FAQ.
 *
 * Distinct from CompanySource on purpose. A source is something a human READ
 * against this profile, which is what lets the page claim to be checked.
 * An official link is just a pointer: the best available material on how a
 * firm hires is usually the firm's own, and it was never linked.
 */
export interface OfficialLink {
  label: string;
  /** Must be https and on the company's own domain. Enforced by the seeder. */
  url: string;
  /** Why a student should open it. */
  note: string;
}

/**
 * Everything wrong with a company's official links, as messages.
 *
 * The host check is the load-bearing one. Without it this column becomes a
 * place for prep-vendor links to accumulate, which is the opposite of the
 * point: the value here is precisely that the material is first-party.
 */
export function validateOfficialLinks(
  links: OfficialLink[],
  officialDomain: string | null,
): string[] {
  const problems: string[] = [];

  if (links.length > 0 && !officialDomain) {
    problems.push("has official links but no official_domain to check them against");
    return problems;
  }

  for (const link of links) {
    if (!link.label?.trim()) problems.push("a link has no label");
    if (!link.note?.trim()) problems.push(`"${link.label}" has no note`);

    let url: URL;
    try {
      url = new URL(link.url);
    } catch {
      problems.push(`"${link.label}" has an unparseable url: ${link.url}`);
      continue;
    }

    if (url.protocol !== "https:") {
      problems.push(`"${link.label}" is not https`);
    }

    const host = url.hostname.toLowerCase();
    const domain = officialDomain!.toLowerCase();
    // The firm's own domain or a subdomain of it — careers.bcg.com counts for
    // bcg.com, evilbcg.com does not.
    if (host !== domain && !host.endsWith(`.${domain}`)) {
      problems.push(
        `"${link.label}" points at ${host}, which is not ${domain} or a subdomain of it`,
      );
    }
  }

  return problems;
}

/**
 * Something a profile was checked against: a firm's careers page, a placement
 * cell's report. A profile with none is unverified and says so.
 */
export interface CompanySource {
  label: string;
  url: string;
  /** YYYY-MM-DD, the day someone read the source against the profile. */
  checked_on: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Everything wrong with a profile's sources, as messages. Empty means valid.
 *
 * `today` is passed in rather than read, so a check dated tomorrow is refused
 * the same way in a test as in the seeder.
 */
export function sourceProblems(sources: CompanySource[], today: string): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const s of sources) {
    const label = s.label?.trim() ?? "";
    if (label.length < 3 || label.length > 120) problems.push(`source label "${label}" must be 3–120 characters`);

    let url: URL | null = null;
    try {
      url = new URL(s.url);
    } catch {
      problems.push(`source ${s.url} is not a URL`);
    }
    if (url) {
      if (url.protocol !== "https:") problems.push(`source ${s.url} must use https`);
      if (!url.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.)/.test(url.hostname)) {
        problems.push(`source ${s.url} is not a public address`);
      }
      const key = url.href.replace(/\/$/, "");
      if (seen.has(key)) problems.push(`source ${s.url} is listed twice`);
      seen.add(key);
    }

    const date = new Date(`${s.checked_on}T00:00:00Z`);
    if (!ISO_DATE.test(s.checked_on ?? "") || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== s.checked_on) {
      problems.push(`source ${s.url} has checked_on "${s.checked_on}", which is not a YYYY-MM-DD date`);
    } else if (s.checked_on > today) {
      problems.push(`source ${s.url} is dated ${s.checked_on}, which is in the future`);
    }
  }
  return problems;
}

/** The most recent check across a profile's sources, or null if it has none. */
export function lastChecked(sources: CompanySource[]): string | null {
  return sources.reduce<string | null>((latest, s) => (latest === null || s.checked_on > latest ? s.checked_on : latest), null);
}

/**
 * Internal paths a profile may link to. Checked by the seeder so a typo cannot
 * ship a dead link, and so a profile can never link off-site.
 */
export const PRACTICE_PREFIXES = [
  "/cases",
  "/practice",
  "/interview",
  "/resume",
  "/gd",
  "/daily",
  "/sql",
  "/excel",
  "/simulation",
  "/negotiation",
  "/peer",
  "/competitions",
] as const;

export function isPracticeHref(href: string): boolean {
  return PRACTICE_PREFIXES.some((p) => href === p || href.startsWith(`${p}?`) || href.startsWith(`${p}/`));
}

/** The current academic placement year and a few before it, newest first. */
export function reportYears(now: Date = new Date()): number[] {
  const latest = now.getUTCFullYear();
  const years: number[] = [];
  for (let y = latest; y >= REPORT_LIMITS.earliestYear; y--) years.push(y);
  return years;
}
