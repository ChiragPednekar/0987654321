import Link from "next/link";
import type { Metadata } from "next";
import { requireTeacherActor, batchesTaughtBy } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { QuestionEditor } from "@/components/teacher/question-editor";

export const metadata: Metadata = { title: "Write a question" };

export default async function NewQuestionPage() {
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
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Write a question</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your own case, graded by the same rubric machinery as the platform library.
      </p>
      <div className="mt-6">
        <QuestionEditor batches={batches ?? []} />
      </div>
    </div>
  );
}
