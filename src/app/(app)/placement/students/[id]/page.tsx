import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlacement, collegeData } from "@/lib/placement/server";
import { ReviewForm } from "@/components/placement/forms";
import { latestReviews } from "@/lib/placement/core";
import { photosForFindings } from "@/lib/proctor-evidence";
import { EvidenceThumb } from "@/components/proctor/evidence-thumb";
import { formatDuration } from "@/lib/utils";
import type { PlacementAttempt } from "@/lib/placement/types";

const CAMERA_NOTE: Record<string, string> = {
  on: "Camera on throughout",
  denied: "Camera refused by the student",
  unavailable: "No camera on this device",
  failed: "Camera detector failed to start",
};

/** What the proctor recorded for one sitting. Shown to staff only; never in a company report. */
function ProctoringRecord({ attempt, photos }: { attempt: PlacementAttempt; photos: { kind: string; takenAt: string; url: string }[] }) {
  const integrity = attempt.integrity;
  if (!integrity) {
    return <p className="text-xs text-muted-foreground">Submitted before proctoring was required — no proctoring record.</p>;
  }
  const clean = integrity.flags.length === 0 && integrity.camera === "on";
  return (
    <div className={`space-y-2 rounded-lg border p-3 text-sm ${clean ? "" : "border-amber-500/50 bg-amber-500/5"}`}>
      <p className="flex items-center gap-2 font-medium">
        {clean ? <ShieldCheck className="size-4 text-[var(--success)]" /> : <ShieldAlert className="size-4 text-amber-600" />}
        Proctored sitting · {CAMERA_NOTE[integrity.camera]}
        {attempt.elapsed_seconds !== null && <span className="font-normal text-muted-foreground">· {formatDuration(attempt.elapsed_seconds)}</span>}
      </p>
      {integrity.flags.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {integrity.flags.map((f) => <li key={f.code}>· {f.label}</li>)}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nothing flagged.</p>
      )}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {photos.map((p) => <EvidenceThumb key={p.url} photo={p} />)}
        </div>
      )}
      {!clean && (
        <p className="text-xs text-muted-foreground">
          Flags are prompts for your judgement, not findings. Check the photos and the answer before deciding; if you discount the result, say why in the review reason.
        </p>
      )}
    </div>
  );
}

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ institution?: string }> }) {
  const { id } = await params;
  const { institution } = await searchParams;
  if (!institution) notFound();
  await requirePlacement(institution);
  const data = await collegeData(institution);
  const user = data.users.find((u) => u.id === id);
  if (!user) notFound();

  const profile = data.profiles.find((p) => p.user_id === id);
  const attempts = data.attempts.filter((a) => a.user_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const reviews = latestReviews(data.reviews);
  // Evidence photos are matched to each sitting by account and time window.
  const photos = await photosForFindings(
    createAdminClient(),
    attempts.filter((a) => a.integrity).map((a) => ({ id: a.id, user_id: a.user_id, created_at: a.created_at, server_elapsed_seconds: a.elapsed_seconds })),
  );

  return (
    <div className="space-y-6">
      <Link href={`/placement?institution=${institution}`} className="text-sm underline">Back to college</Link>
      <header>
        <h1 className="font-editorial text-4xl">{user.full_name ?? "Student"}</h1>
        <p className="mt-2 text-muted-foreground">
          {[profile?.target_role || "Target role not set", profile?.programme, profile?.specialisation].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-2 text-sm">{user.email} · Recruitment sharing {user.open_to_opportunities ? "on" : "off"}</p>
        {profile?.resume_url && profile.share_resume && (
          <a href={profile.resume_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm underline">Student-shared résumé</a>
        )}
      </header>
      <p className="rounded-lg bg-muted/40 p-4 text-sm">
        Only common college assessments appear here. The private diagnostic and practice attempts stay in the student&apos;s own workspace. Results from different tasks are shown separately, not as a before-and-after comparison.
      </p>
      {!attempts.length && <p>Insufficient evidence. This student has not submitted a common assessment.</p>}
      {attempts.map((a) => {
        const assessment = data.assessments.find((x) => x.id === a.assessment_id)!;
        const review = reviews.get(a.id);
        const history = data.reviews.filter((r) => r.attempt_id === a.id);
        return (
          <article key={a.id} className="space-y-4 rounded-xl border p-5">
            <div>
              <h2 className="text-xl font-medium">{assessment.title}</h2>
              <p className="text-xs text-muted-foreground">{assessment.domain} · Submitted {new Date(a.created_at).toLocaleString()}</p>
              <p className="mt-2 text-sm">
                {review ? `Faculty-reviewed: ${review.percentage.toFixed(1)}%` : a.status === "evaluated" ? "AI-evaluated · awaiting independent review" : a.status}
              </p>
            </div>
            <ProctoringRecord attempt={a} photos={photos.get(a.id) ?? []} />
            <details>
              <summary className="cursor-pointer text-sm">Question and faculty calibration examples</summary>
              <p className="my-3 whitespace-pre-wrap text-sm">{assessment.scenario}</p>
              <p className="whitespace-pre-wrap text-sm">{assessment.reference_answer}</p>
              {assessment.examples.map((e) => (
                <div key={e.level} className="my-3 rounded border p-3 text-sm">
                  <strong className="capitalize">{e.level}</strong>
                  <p className="whitespace-pre-wrap">{e.answer}</p>
                  <p className="mt-2 text-muted-foreground">{e.explanation}</p>
                </div>
              ))}
            </details>
            <div className="whitespace-pre-wrap rounded-lg bg-muted/30 p-4 text-sm">{a.answer}</div>
            {a.status === "evaluated" && <ReviewForm attempt={a} assessment={assessment} />}
            <details>
              <summary className="cursor-pointer text-sm">Review history ({history.length})</summary>
              {history.map((r) => (
                <div key={r.id} className="my-3 border-l-2 pl-3 text-sm">
                  <p>{r.percentage.toFixed(1)}% · {new Date(r.created_at).toLocaleString()}</p>
                  <p className="whitespace-pre-wrap">{r.feedback}</p>
                  <p className="text-muted-foreground">Reason: {r.reason}</p>
                </div>
              ))}
            </details>
          </article>
        );
      })}
    </div>
  );
}
