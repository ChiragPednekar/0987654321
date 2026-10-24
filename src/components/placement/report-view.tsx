import type { reportEvidence } from "@/lib/placement/server";
import { GD_SKILLS } from "@/lib/placement/core";

export function ReportView({
  title,
  evidence,
}: {
  title: string;
  evidence: Awaited<ReturnType<typeof reportEvidence>>;
}) {
  return (
    <article className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">CaseCode · College-reviewed evidence</p>
        <h1 className="mt-2 font-editorial text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {evidence.candidates.length} approved candidates from a college roster of {evidence.cohortSize}. Results are
          task-specific, faculty-reviewed and from common assessments sat under camera proctoring and in-person group
          discussions. They support human review; they are not a prediction of job performance.
        </p>
      </header>

      <section className="rounded-xl border p-4">
        <h2 className="font-medium">Comparison context</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Compare scores only within the same assessment below. Candidates are listed alphabetically, with no combined
          hiring rank. Missing results mean insufficient evidence.
        </p>
        {evidence.assessments.map((a) => (
          <p key={a.id} className="mt-3 text-sm">
            <strong>{a.title}</strong> · {a.target_role}
            <span className="block text-xs text-muted-foreground">
              {Object.entries(a.criteria)
                .map(([k, v]) => `${k.replaceAll("_", " ")} / ${v}`)
                .join(" · ")}
            </span>
          </p>
        ))}
      </section>

      {!evidence.candidates.length && (
        <p className="rounded border p-5">
          No candidates currently meet the report&apos;s sharing and review requirements.
        </p>
      )}

      {[...evidence.candidates]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => {
          const gdReviews = c.gd ?? [];
          return (
            <section key={c.id} className="break-inside-avoid space-y-4 rounded-xl border p-5">
              <header className="space-y-1">
                <h2 className="text-xl font-semibold">{c.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {c.target_role} · {c.specialisation} · {c.programme} {c.graduation_year}
                </p>
                {c.email && <p className="text-sm">Contact: {c.email}</p>}
                {c.resume_url && (
                  <a
                    href={c.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm underline"
                  >
                    Student-authorised résumé
                  </a>
                )}
                <p className="text-xs text-muted-foreground">
                  {c.evidence.length} reviewed assessment{c.evidence.length === 1 ? "" : "s"}
                  {gdReviews.length > 0 &&
                    ` · ${gdReviews.length} group discussion review${gdReviews.length === 1 ? "" : "s"}`}
                </p>
              </header>

              <div className="space-y-3">
                <h3 className="font-medium">Common assessments</h3>
                {evidence.assessments.map((a) => {
                  const result = c.evidence.find((e) => e.assessment_id === a.id);
                  return (
                    <div key={a.id} className="space-y-2 rounded-lg border bg-muted/10 p-4">
                      <h4 className="font-medium">{a.title}</h4>
                      {!result ? (
                        <p className="text-sm text-muted-foreground">Insufficient evidence for this assessment.</p>
                      ) : (
                        <>
                          <p className="text-sm">
                            {result.percentage.toFixed(1)}% · {result.proctored ? "Proctored · " : ""}Faculty-reviewed
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Assessed {result.date ? new Date(result.date).toLocaleDateString() : "—"} · Reviewed{" "}
                            {new Date(result.reviewed_at).toLocaleDateString()}
                          </p>
                          <dl className="grid gap-2 sm:grid-cols-4">
                            {Object.entries(a.criteria).map(([k, max]) => (
                              <div key={k} className="rounded bg-muted/30 p-2 text-xs">
                                <dt className="capitalize">{k.replaceAll("_", " ")}</dt>
                                <dd className="mt-1 font-medium">
                                  {result.scores[k] ?? "—"} / {max}
                                </dd>
                              </div>
                            ))}
                          </dl>
                          {result.feedback && <p className="whitespace-pre-wrap text-sm">{result.feedback}</p>}
                          {result.work && (
                            <details>
                              <summary className="cursor-pointer text-sm">Selected work sample</summary>
                              <p className="mt-2 whitespace-pre-wrap text-sm">{result.work}</p>
                            </details>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">Group discussion feedback</h3>
                  {gdReviews.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {gdReviews.length} teacher review{gdReviews.length === 1 ? "" : "s"} · In-person observation
                    </span>
                  )}
                </div>
                {gdReviews.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No teacher group discussion reviews on record.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {GD_SKILLS.map((skill) => {
                        const values = gdReviews.map((d) => Number(d.scores[skill])).filter(Number.isFinite);
                        const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
                        return (
                          <div key={skill} className="rounded bg-muted/30 p-2 text-xs">
                            <dt className="capitalize text-muted-foreground">{skill}</dt>
                            <dd className="mt-1 font-medium">{avg === null ? "—" : `${avg.toFixed(1)} / 5`}</dd>
                          </div>
                        );
                      })}
                    </div>
                    <div className="space-y-2">
                      {gdReviews.map((d) => (
                        <article key={d.id} className="rounded-lg border bg-muted/10 p-3 text-sm">
                          <div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{d.topic}</span>
                            <span>
                              {d.reviewer} · {new Date(d.date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {GD_SKILLS.map((k) => `${k} ${d.scores[k] ?? "—"}/5`).join(" · ")}
                          </p>
                          {d.feedback && <p className="mt-2 whitespace-pre-wrap text-sm">{d.feedback}</p>}
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>
          );
        })}
    </article>
  );
}
