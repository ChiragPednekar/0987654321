/**
 * Postgres stores `supporting_data` as jsonb, which reorders keys shortest
 * first — "Exhibit 3 — customer segments" comes back before "Exhibit 2 — demand
 * sensitivity". Numbered exhibits are put back in order; other keys keep theirs.
 */
export function orderedEntries(data: Record<string, unknown>) {
  const entries = Object.entries(data);
  const exhibitNo = (key: string) => Number(/^exhibit\s+(\d+)/i.exec(key)?.[1] ?? NaN);
  if (!entries.every(([key]) => Number.isFinite(exhibitNo(key)))) return entries;
  return entries.sort(([a], [b]) => exhibitNo(a) - exhibitNo(b));
}
