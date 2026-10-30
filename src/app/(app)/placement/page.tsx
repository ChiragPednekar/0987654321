import Link from "next/link";
import { requireActor } from "@/lib/authz";
import { placementInstitutions, requirePlacement, collegeData } from "@/lib/placement/server";
import { summarizeEvidence } from "@/lib/placement/core";
import { StudentDirectory } from "@/components/placement/student-directory";
import { AssessmentForm, PlacementAction } from "@/components/placement/forms";
import { CollegeOverview, loadOverview } from "@/components/placement/college-overview";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Placement Cell" };

export default async function PlacementPage({ searchParams }: { searchParams: Promise<{ institution?: string }> }) {
  const query = await searchParams;
  const actor = await requireActor();
  const colleges = await placementInstitutions(actor);
  const id = query.institution ?? colleges[0]?.id;
  if (!id) return null;

  const { institution } = await requirePlacement(id);
  const data = await collegeData(id);
  const overview = await loadOverview(id, data);
  const summary = summarizeEvidence(data.attempts, data.reviews);
  // Practice activity only — counts and recency, never practice scores — so
  // the directory can find who has not started without exposing their mistakes.
  const activity = Object.fromEntries(
    overview.roster.map((r) => [r.user_id, { solved: r.cases_solved, lastActive: r.last_active }]),
  );
  // eslint-disable-next-line react-hooks/purity -- server component, renders once per request.
  const now = Date.now();

  return (
    <div className="space-y-8">
      <header className="dashboard-hero flex flex-wrap items-end justify-between gap-4 p-6 sm:p-8">
        <div>
          <h1 className="text-2xl font-semibold">{institution.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Prepare the whole batch. Review the evidence. Share the right candidates.
          </p>
        </div>
        <Button asChild>
          <Link href={`/placement/reports/new?institution=${id}`}>Create company report</Link>
        </Button>
      </header>

      <CollegeOverview overview={overview} data={data} now={now} />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Awaiting faculty review", summary.pending, "#directory"],
          ["Open company requests", data.requests.filter((r) => r.status === "open").length, "#requests"],
          ["Interview requests to action", data.interviewRequests.filter((r) => r.status === "requested").length, "#interviews"],
        ].map(([label, value, href]) => (
          <a key={label} href={String(href)} className="rounded-xl border p-5 hover:bg-muted/30">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular">{value}</p>
          </a>
        ))}
      </div>

      <div id="directory">
        <StudentDirectory data={data} institutionId={id} activity={activity} now={now} />
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-medium">Common assessments</h2>
        <p className="text-sm text-muted-foreground">
          The same task and rubric for every enrolled student, independent of their paid practice allowance. These — not practice — are what company reports compare.
        </p>
        {data.assessments.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div>
              <h3 className="font-medium">{a.title}</h3>
              <p className="text-xs text-muted-foreground">
                {a.target_role} · {a.domain} · {a.status} ·{" "}
                {data.attempts.filter((x) => x.assessment_id === a.id && x.status === "evaluated").length} of {data.users.length} completed
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/preparation/assessments/${a.id}`}>View task</Link>
              </Button>
              {a.status === "draft" && (
                <PlacementAction body={{ action: "assessment_status", id: a.id, status: "open" }}>Open to students</PlacementAction>
              )}
              {a.status === "open" && (
                <PlacementAction body={{ action: "assessment_status", id: a.id, status: "closed" }}>Close assessment</PlacementAction>
              )}
            </div>
          </div>
        ))}
        <AssessmentForm institutionId={id} />
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="font-medium">Is the AI grading trustworthy here?</h2>
        <p className="mt-2 text-sm">
          {summary.reviewed} results reviewed independently by faculty.{" "}
          {summary.meanReviewDifference === null
            ? "Review a few common-assessment answers to see how closely the AI agrees with your faculty."
            : `On average the AI and faculty differ by ${summary.meanReviewDifference.toFixed(1)} percentage points.`}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Only faculty-reviewed results can go into a company report. This figure is score agreement, not hiring accuracy.
        </p>
      </section>

      <section id="requests" className="space-y-3">
        <h2 className="text-xl font-medium">Company requests</h2>
        {!data.requests.length && <p className="text-sm text-muted-foreground">Requests from recruiter accounts will appear here.</p>}
        {data.requests.map((r) => (
          <article key={r.id} className="rounded-xl border p-4">
            <h3 className="font-medium">{r.company} · {r.target_role}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm">{r.requirements}</p>
            <p className="my-2 text-xs text-muted-foreground">{r.status} · {new Date(r.created_at).toLocaleDateString()}</p>
            <Link className="text-sm underline" href={`/placement/reports/new?institution=${id}&request=${r.id}`}>Prepare a shortlist report</Link>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Reports</h2>
        {!data.reports.length && (
          <p className="text-sm text-muted-foreground">Create a draft to choose candidates and preview exactly what the company will see.</p>
        )}
        {data.reports.map((r) => (
          <Link key={r.id} className="flex justify-between rounded-lg border p-4 text-sm" href={`/placement/reports/${r.id}`}>
            <span>{r.title}<small className="block text-muted-foreground">{r.recipient_email}</small></span>
            <span>{r.status}{r.expires_at && ` · expires ${new Date(r.expires_at).toLocaleDateString()}`}</span>
          </Link>
        ))}
      </section>

      <section id="interviews" className="space-y-3">
        <h2 className="text-xl font-medium">Interview requests</h2>
        {!data.interviewRequests.length && (
          <p className="text-sm text-muted-foreground">Company interview requests come back to this placement cell, never straight to students.</p>
        )}
        {data.interviewRequests.map((r) => (
          <article key={r.id} className="space-y-2 rounded-lg border p-4">
            <p className="font-medium">{data.reports.find((p) => p.id === r.report_id)?.title} · {r.status}</p>
            <p className="text-sm">{r.student_ids.map((sid) => data.users.find((u) => u.id === sid)?.full_name ?? "Former student").join(", ")}</p>
            <p className="whitespace-pre-wrap text-sm">{r.message}</p>
            <div className="flex gap-2">
              <PlacementAction body={{ action: "interview_status", id: r.id, status: "contacted" }}>Mark contacted</PlacementAction>
              <PlacementAction body={{ action: "interview_status", id: r.id, status: "closed" }}>Close</PlacementAction>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
