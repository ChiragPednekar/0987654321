import type { AssignmentKind } from "@/lib/types/database";

/**
 * What an assignment points at, in one place.
 *
 * An assignment used to be a case and nothing else, so every page read
 * `cases(slug, title)` and linked to `/cases/<slug>`. Since 20250101000067 it
 * can also be an SQL exercise, an Excel exercise or an aptitude quiz; this
 * resolves any of them to a title, a label and the page a student opens.
 */

export const ASSIGNMENT_KIND_LABEL: Record<AssignmentKind, string> = {
  case: "Case",
  sql: "SQL",
  excel: "Excel",
  aptitude: "Aptitude quiz",
};

type Embedded<T> = T | T[] | null | undefined;

const one = <T,>(value: unknown): T | null => {
  const v = value as Embedded<T>;
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
};

/**
 * The embedded rows are typed `unknown` on purpose: the generated database
 * types carry no relationships, so supabase-js types every embed as a query
 * error. The shapes are checked here instead, at the one place they are read.
 */
export interface AssignmentTargetRow {
  id: string;
  title?: string | null;
  kind?: AssignmentKind | string | null;
  question_ids?: string[] | null;
  cases?: unknown;
  sql_exercises?: unknown;
  excel_exercises?: unknown;
}

type CaseEmbed = { slug: string; title: string; domain?: string; difficulty?: string };
type ExerciseEmbed = { slug: string; title: string };

export interface AssignmentTarget {
  kind: AssignmentKind;
  kindLabel: string;
  /** The assigned item's own title — the assignment may carry a different one. */
  itemTitle: string;
  /** Where a student goes to do it. Null when the item no longer exists. */
  href: string | null;
  /** Case-only extras for the student list. */
  domain?: string;
  difficulty?: string;
}

export function assignmentTarget(row: AssignmentTargetRow): AssignmentTarget {
  const kind = (row.kind ?? "case") as AssignmentKind;
  const base = { kind, kindLabel: ASSIGNMENT_KIND_LABEL[kind] ?? "Case" };

  if (kind === "sql") {
    const ex = one<ExerciseEmbed>(row.sql_exercises);
    return { ...base, itemTitle: ex?.title ?? "SQL exercise", href: ex ? `/sql/${ex.slug}` : null };
  }
  if (kind === "excel") {
    const ex = one<ExerciseEmbed>(row.excel_exercises);
    return { ...base, itemTitle: ex?.title ?? "Excel exercise", href: ex ? `/excel/${ex.slug}` : null };
  }
  if (kind === "aptitude") {
    const n = row.question_ids?.length ?? 0;
    return {
      ...base,
      itemTitle: `${n} question${n === 1 ? "" : "s"}`,
      href: `/practice/assigned/${row.id}`,
    };
  }
  const c = one<CaseEmbed>(row.cases);
  return {
    ...base,
    itemTitle: c?.title ?? "Case",
    href: c ? `/cases/${c.slug}` : null,
    domain: c?.domain,
    difficulty: c?.difficulty,
  };
}
