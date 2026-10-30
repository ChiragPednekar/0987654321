/**
 * The dashboard greeting, worked out in IST: the page is rendered on a server
 * in another timezone, and "Good evening" at 9 a.m. would be worse than none.
 * Before 5 a.m. it is still the evening for someone up studying.
 */
export function greetingFor(now: Date = new Date()): string {
  const hourIst = Number(
    now.toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }),
  ) % 24;
  if (hourIst < 5) return "Good evening";
  if (hourIst < 12) return "Good morning";
  if (hourIst < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Only a word that reads as a name goes in the headline. Accounts created
 * from an email address can carry a handle like "jdoe-2024", and that set
 * large is worse than no name at all.
 */
export function greetingName(fullName: string | null | undefined): string | null {
  const firstWord = fullName?.trim().split(/\s+/)[0] ?? "";
  return /^[\p{L}][\p{L}'’.-]{0,19}$/u.test(firstWord) ? firstWord : null;
}
