import {
  ANSWER_SECTIONS,
  CASE_ANSWER_SECTIONS,
  type AnswerSectionDef,
  type AnswerSectionKey,
} from "@/lib/constants";

/**
 * Which boxes a written answer is split into. A full case gets the seven-step
 * case answer; every other written format keeps the three-part one.
 */
export function sectionsFor(format: string | null | undefined): readonly AnswerSectionDef[] {
  return format === "full_case" ? CASE_ANSWER_SECTIONS : ANSWER_SECTIONS;
}

export type SectionValues = Partial<Record<AnswerSectionKey, string>>;

export function emptySections(defs: readonly AnswerSectionDef[]): SectionValues {
  return Object.fromEntries(defs.map((d) => [d.key, ""]));
}

/**
 * The single markdown answer the grader reads: each filled box under its own
 * heading, in order. Grading, storage and history all work on this text, so
 * they are the same whichever editor wrote it.
 */
export function composeAnswer(defs: readonly AnswerSectionDef[], values: SectionValues): string {
  return defs
    .map(({ key, label }) => {
      const body = (values[key] ?? "").trim();
      return body ? `## ${label}\n\n${body}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

/** The filled boxes only, for the answer_sections column. */
export function filledSections(defs: readonly AnswerSectionDef[], values: SectionValues): SectionValues {
  return Object.fromEntries(
    defs.map(({ key }) => [key, (values[key] ?? "").trim()]).filter(([, v]) => v),
  );
}

/** The first box still short of its minimum, to name it rather than just refuse. */
export function firstIncomplete(defs: readonly AnswerSectionDef[], values: SectionValues): AnswerSectionDef | undefined {
  return defs.find((d) => (values[d.key] ?? "").trim().length < d.minChars);
}

/**
 * A draft written in the three-part layout, opened in the seven-step one:
 * "framework" becomes "structure", and analysis and recommendation carry over
 * as they are. Nothing a student typed is dropped.
 */
export function carryOverDraft(defs: readonly AnswerSectionDef[], saved: Record<string, string | undefined>): SectionValues {
  const values: SectionValues = { ...emptySections(defs) };
  const keys = new Set(defs.map((d) => d.key));
  for (const [key, value] of Object.entries(saved)) {
    if (typeof value !== "string") continue;
    if (keys.has(key as AnswerSectionKey)) values[key as AnswerSectionKey] = value;
  }
  if (keys.has("structure") && !values.structure && saved.framework) values.structure = saved.framework;
  return values;
}
