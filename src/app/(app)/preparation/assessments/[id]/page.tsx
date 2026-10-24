import { notFound } from "next/navigation";
import { requireActor } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { placementInstitutions } from "@/lib/placement/server";
import { AnswerTask } from "@/components/preparation/workspace";
import { ProctoredAssessment } from "@/components/preparation/proctored-assessment";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const db = createAdminClient();
  const { data: a } = await db.from("placement_assessments").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();

  const { data: m } = await db.from("institution_members").select("role").eq("institution_id", a.institution_id).eq("user_id", actor.id).maybeSingle();
  const staff = (await placementInstitutions(actor)).some((i) => i.id === a.institution_id);
  if (!staff && (!m || m.role !== "student" || a.status === "draft")) notFound();

  const { data: attempt } = await db.from("placement_attempts").select("*").eq("assessment_id", id).eq("user_id", actor.id).maybeSingle();
  const { data: reviews } = attempt
    ? await db.from("placement_reviews").select("*").eq("attempt_id", attempt.id).order("created_at", { ascending: false })
    : { data: [] };
  // eslint-disable-next-line react-hooks/purity -- server component, renders once per request.
  const open = a.status === "open" && (!a.closes_at || new Date(a.closes_at).getTime() > Date.now());
  const student = m?.role === "student";
  // The question stays hidden from a student until the proctored sitting
  // starts; once they have submitted, or to staff, it is shown.
  const showQuestion = staff || Boolean(attempt) || !open;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-5 sm:p-8">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Common college assessment · {a.status}</p>
      <h1 className="font-editorial text-4xl">{a.title}</h1>
      {showQuestion && <p className="whitespace-pre-wrap leading-relaxed">{a.scenario}</p>}
      <p className="text-sm text-muted-foreground">
        Rubric: {Object.entries(a.criteria).map(([k, v]) => `${k.replaceAll("_", " ")} / ${v}`).join(" · ")}
      </p>
      <p className="rounded-lg border p-3 text-xs text-muted-foreground">
        Proctored, one submission per student, and the same task for everyone at your college. Staff review each result — and anything the camera flagged — before it can appear in a company report.
      </p>

      {attempt?.status === "evaluated" ? (
        <section className="space-y-3 rounded-xl border p-5">
          <h2 className="font-medium">Your submitted result</h2>
          <p className="text-sm">AI-evaluated: {attempt.result?.percentage.toFixed(1)}%</p>
          <p className="text-sm">{attempt.result?.feedback.verdict}</p>
          {reviews?.map((r, i) => (
            <div key={r.id} className="border-t pt-3">
              <p className="text-sm">{i === 0 ? "Current faculty review" : "Earlier faculty review"}: {r.percentage.toFixed(1)}% · {new Date(r.created_at).toLocaleDateString()}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{r.feedback}</p>
            </div>
          ))}
          {!reviews?.length && <p className="text-sm text-muted-foreground">Awaiting faculty review. Contact your placement cell if you need a correction.</p>}
        </section>
      ) : attempt?.status === "processing" ? (
        <p>Your answer is being evaluated. Refresh shortly.</p>
      ) : attempt?.status === "failed" && student ? (
        <AnswerTask action="assessment" assessmentId={id} initialAnswer={attempt.answer} failed />
      ) : open && student ? (
        <ProctoredAssessment assessmentId={id} title={a.title} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {staff ? "Staff preview. Students sit this under exam conditions while it is open." : "This assessment is closed."}
        </p>
      )}

      {(staff || (!open && attempt?.status === "evaluated")) && (
        <details className="rounded-xl border p-5">
          <summary className="cursor-pointer font-medium">Reference answer and calibration examples</summary>
          <p className="mt-4 whitespace-pre-wrap text-sm">{a.reference_answer}</p>
          {a.examples.map((e) => (
            <div key={e.level} className="mt-4 border-t pt-3 text-sm">
              <strong className="capitalize">{e.level} answer</strong>
              <p className="mt-2 whitespace-pre-wrap">{e.answer}</p>
              <p className="mt-2 text-muted-foreground">{e.explanation}</p>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
