import Link from "next/link";
import type { Metadata } from "next";
import { requireTeacherActor, batchesTaughtBy } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { QuestionEditor } from "@/components/teacher/question-editor";
import { AptitudeQuestionForm } from "@/components/teacher/aptitude-question-form";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Add a question" };

const KINDS = [
  { value: "case", label: "Case or written question", blurb: "Graded by AI against a rubric you write." },
  { value: "aptitude", label: "Aptitude question", blurb: "Multiple choice, marked against your answer key." },
] as const;

/**
 * Where any teacher adds their own questions — reached from "Add question" in
 * the Library menu and from the question bank. No batch is needed first: a
 * question written without one belongs to the teacher and can be assigned to
 * any batch they teach later.
 */
export default async function NewQuestionPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const kind = type === "aptitude" ? "aptitude" : "case";

  const actor = await requireTeacherActor();
  const admin = createAdminClient();
  const ids = await batchesTaughtBy(actor.id);

  const { data: batches } = ids.length
    ? await admin.from("classrooms").select("id, name").in("id", ids)
    : { data: [] };

  return (
    <div className="max-w-3xl">
      <Link href="/teacher/questions" className="text-sm text-muted-foreground hover:text-foreground">
        ← Question bank
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Add a question</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your questions stay private to you and the batches you assign them to.
        Add them to a batch from the library, like any other question.
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2" role="tablist" aria-label="Kind of question">
        {KINDS.map((k) => (
          <Link
            key={k.value}
            href={`/teacher/questions/new?type=${k.value}`}
            role="tab"
            aria-selected={kind === k.value}
            className={cn(
              "rounded-lg border p-3 text-sm transition-colors",
              kind === k.value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-foreground/25",
            )}
          >
            <span className="font-medium">{k.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{k.blurb}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6">
        {kind === "aptitude" ? (
          <AptitudeQuestionForm />
        ) : (
          <QuestionEditor batches={batches ?? []} />
        )}
      </div>
    </div>
  );
}
