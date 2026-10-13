import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ObjectiveRunner } from "@/components/practice/objective-runner";
import { TeacherQuestionList, type TeacherQuestion } from "@/components/practice/teacher-question-list";
import { PickHint } from "@/components/teacher/pick-hint";
import { OBJECTIVE_TRACKS } from "@/lib/objective";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string }>;
}): Promise<Metadata> {
  const { track } = await params;
  const meta = OBJECTIVE_TRACKS.find((t) => t.value === track);
  return { title: meta?.label ?? "Practice" };
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ track: string }>;
}) {
  const { track } = await params;
  const meta = OBJECTIVE_TRACKS.find((t) => t.value === track);
  if (!meta) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/practice/${track}`);

  // Teachers also get every question in the track, to pick from for a quiz:
  // the published bank plus the questions they wrote themselves.
  const profile = await getCurrentUser();
  const canAssign = profile?.role === "teacher" || profile?.role === "admin";
  let questions: TeacherQuestion[] = [];
  if (canAssign) {
    const { data } = await createAdminClient()
      .from("objective_questions")
      .select("id, stem, context, topic, difficulty, options, correct_index, is_published, created_by")
      .eq("track", meta.value)
      .or(`is_published.eq.true,created_by.eq.${user.id}`)
      .order("difficulty")
      .order("created_at")
      .limit(300);
    questions = (data ?? []).map((q) => ({
      id: q.id,
      stem: q.stem,
      context: q.context,
      topic: q.topic,
      difficulty: q.difficulty,
      options: q.options,
      correct_index: q.correct_index,
      own: q.created_by === user.id,
    }));
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/practice"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All practice
      </Link>
      <div className="mt-4">
        <ObjectiveRunner track={meta} />
      </div>
      {canAssign && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">
            Questions in this track{" "}
            <span className="text-sm font-normal text-muted-foreground tabular">({questions.length})</span>
          </h2>
          <PickHint noun="questions — together they become one quiz —" />
          <div className="mt-4">
            <TeacherQuestionList questions={questions} />
          </div>
        </section>
      )}
    </div>
  );
}
