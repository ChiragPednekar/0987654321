import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowBigUp,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Users,
} from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { Markdown } from "@/components/markdown";
import { AnswerEditor } from "@/components/case/answer-editor";
import { ScorePanel } from "@/components/case/score-panel";
import { ShareToggle } from "@/components/case/share-toggle";
import { Discussion, type DiscussionComment } from "@/components/case/discussion";
import { Badge } from "@/components/ui/badge";
import { BookmarkButton } from "@/components/case/bookmark-button";
import { HintsPanel, type HintStub } from "@/components/case/hints-panel";
import { ReportForm } from "@/components/case/report-form";
import {
  DrillRunner,
  type DrillQuestion,
} from "@/components/case/drill-runner";
import {
  ModelWorkspace,
  type ModelCell,
} from "@/components/case/model-workspace";
import { CaseChat } from "@/components/case/case-chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DIFFICULTY_CLASS, DOMAIN_LABEL } from "@/lib/constants";
import { cn, initials, timeAgo, truncate } from "@/lib/utils";
import type {
  Attachment,
  Difficulty,
  Domain,
  RubricCriteria,
  ScoreRow,
} from "@/lib/types/database";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ submission?: string; tab?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("title, scenario")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return { title: "Case not found" };

  return {
    title: data.title,
    description: truncate(data.scenario.replace(/[#*`>]/g, ""), 155),
  };
}

export default async function CaseDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const query = await searchParams;

  const supabase = await createClient();
  const profile = await getCurrentUser();

  const { data: caseData } = await supabase
    .from("cases")
    // Explicit column list rather than "*": `model_answer` is revoked from
    // anon and authenticated (20250101000015_read_privileges.sql) so that the
    // worked solution cannot be pulled straight out of PostgREST, and a "*"
    // here would ask for it and fail.
    // Must stay one string literal: supabase-js infers the row type from it,
    // and a concatenated expression collapses to GenericStringError.
    .select(
      "id, slug, title, domain, difficulty, category_id, company_track, estimated_minutes, scenario, supporting_data, attachments, instructions, expected_framework, tags, is_published, created_by, total_submissions, total_solved, avg_score, completion_rate, created_at, updated_at, format, firm_style, is_pro, rubrics(criteria, max_score, pass_score), case_categories(name)",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!caseData) notFound();

  const rubric = (
    Array.isArray(caseData.rubrics) ? caseData.rubrics[0] : caseData.rubrics
  ) as { criteria: RubricCriteria; max_score: number; pass_score: number } | null;

  // Viewer's own history for this case.
  let mySubmissions: Array<{
    id: string;
    created_at: string;
    attempt_number: number;
    is_public: boolean;
    answer: string;
    scores: ScoreRow | ScoreRow[] | null;
  }> = [];

  let isBookmarked = false;

  const { data: hintRows } = await supabase
    .from("case_hints")
    .select("id, step, penalty_pct")
    .eq("case_id", caseData.id)
    .order("step");

  const revealedIds = new Set<string>();
  const revealedBodies = new Map<string, string>();

  if (profile) {
    // Bodies of already-revealed hints need the service role for the same
    // reason; this is still scoped to the viewer's own reveals.
    //
    // Optional enrichment, so it must not be able to take the page down: with
    // no service-role key configured the hints panel simply shows them as
    // unrevealed rather than the whole case 500ing.
    const admin = createAdminClientOrNull();
    const { data: reveals } = admin
      ? await admin
          .from("hint_reveals")
          .select("hint_id, case_hints(body)")
          .eq("user_id", profile.id)
          .eq("case_id", caseData.id)
      : { data: null };

    for (const row of reveals ?? []) {
      revealedIds.add(row.hint_id);
      const hint = Array.isArray(row.case_hints)
        ? row.case_hints[0]
        : row.case_hints;
      if (hint?.body) revealedBodies.set(row.hint_id, hint.body);
    }
  }

  let drillQuestions: DrillQuestion[] = [];
  if (caseData.format === "drill") {
    const { data: qs } = await supabase
      .from("drill_questions")
      .select("id, position, prompt, tolerance_pct, unit")
      .eq("case_id", caseData.id)
      .order("position");

    drillQuestions = (qs ?? []) as DrillQuestion[];
  }

  let modelCells: ModelCell[] = [];
  if (caseData.format === "model") {
    const { data: cs } = await supabase
      .from("model_cells")
      .select("id, row_index, col_index, label, tolerance_pct, unit")
      .eq("case_id", caseData.id)
      .order("row_index")
      .order("col_index");

    modelCells = (cs ?? []) as ModelCell[];
  }

  const hints: HintStub[] = (hintRows ?? []).map((h) => ({
    id: h.id,
    step: h.step,
    penalty_pct: h.penalty_pct,
    body: revealedIds.has(h.id) ? (revealedBodies.get(h.id) ?? null) : null,
  }));

  if (profile) {
    const [{ data }, { data: bookmark }] = await Promise.all([
      supabase
        .from("submissions")
        .select("id, created_at, attempt_number, is_public, answer, scores(*)")
        .eq("user_id", profile.id)
        .eq("case_id", caseData.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("bookmarks")
        .select("case_id")
        .eq("user_id", profile.id)
        .eq("case_id", caseData.id)
        .maybeSingle(),
    ]);

    mySubmissions = (data ?? []) as typeof mySubmissions;
    isBookmarked = Boolean(bookmark);
  }

  const [{ data: topSolutions }, { data: rawComments }, { data: myVotes }] =
    await Promise.all([
      supabase
        .from("submissions")
        .select("id, answer, upvotes, created_at, users(full_name), scores(total_score, max_score, percentage)")
        .eq("case_id", caseData.id)
        .eq("is_public", true)
        .eq("status", "evaluated")
        .order("upvotes", { ascending: false })
        .limit(10),
      supabase
        .from("comments")
        .select("id, body, upvotes, created_at, parent_id, users(full_name, avatar_url)")
        .eq("case_id", caseData.id)
        .eq("is_deleted", false)
        .order("upvotes", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(100),
      profile
        ? supabase.from("comment_votes").select("comment_id").eq("user_id", profile.id)
        : Promise.resolve({ data: [] as { comment_id: string }[] }),
    ]);

  const votedIds = new Set((myVotes ?? []).map((v) => v.comment_id));

  const comments: DiscussionComment[] = (rawComments ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    upvotes: row.upvotes,
    created_at: row.created_at,
    parent_id: row.parent_id,
    author: (Array.isArray(row.users) ? row.users[0] : row.users) as
      | { full_name: string | null; avatar_url: string | null }
      | null,
    viewer_has_voted: votedIds.has(row.id),
  }));

  // Which score to show in the AI Review tab: the one just submitted, else latest.
  const selected =
    mySubmissions.find((s) => s.id === query.submission) ?? mySubmissions[0];
  const selectedScore = (
    Array.isArray(selected?.scores) ? selected?.scores[0] : selected?.scores
  ) as ScoreRow | undefined;

  const bestPercentage = Math.max(
    0,
    ...mySubmissions.map((s) => {
      const score = Array.isArray(s.scores) ? s.scores[0] : s.scores;
      return score ? Number(score.percentage) : 0;
    }),
  );
  const solved = bestPercentage >= (rubric?.pass_score ?? 60);

  const attachments = (caseData.attachments ?? []) as Attachment[];
  const supportingData = caseData.supporting_data as Record<string, unknown>;
  const hasSupportingData =
    supportingData && Object.keys(supportingData).length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* ------------------------------------------------------ header --- */}
      <div className="mb-6">
        <Link
          href="/cases"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All cases
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              {caseData.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">
                {DOMAIN_LABEL[caseData.domain as Domain]}
              </Badge>
              <span
                className={cn(
                  "font-medium capitalize",
                  DIFFICULTY_CLASS[caseData.difficulty as Difficulty],
                )}
              >
                {caseData.difficulty}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3" />
                {caseData.estimated_minutes} min
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Users className="size-3" />
                {caseData.total_submissions} submissions
              </span>
              {caseData.company_track && (
                <Badge variant="outline">{caseData.company_track}</Badge>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {solved && (
              <Badge variant="success" className="gap-1.5 py-1">
                <CheckCircle2 className="size-3.5" />
                Solved · {bestPercentage.toFixed(0)}%
              </Badge>
            )}
            <BookmarkButton
              caseId={caseData.id}
              initiallySaved={isBookmarked}
              signedIn={Boolean(profile)}
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue={query.submission ? "review" : "problem"}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="problem">Problem</TabsTrigger>
          <TabsTrigger value="solution">My Solution</TabsTrigger>
          <TabsTrigger value="interview">Interview</TabsTrigger>
          <TabsTrigger value="top">Top Solutions</TabsTrigger>
          <TabsTrigger value="discussion">
            Discussion
            {comments.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground tabular">
                {comments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="hints">
            Hints
            {hints.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {hints.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="review" id="review">
            AI Review
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------- problem --- */}
        <TabsContent value="problem">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Scenario</CardTitle>
                </CardHeader>
                <CardContent>
                  <Markdown>{caseData.scenario}</Markdown>
                </CardContent>
              </Card>

              {hasSupportingData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Supporting data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SupportingData data={supportingData} />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Your task</CardTitle>
                </CardHeader>
                <CardContent>
                  <Markdown>{caseData.instructions}</Markdown>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {rubric && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      How you&apos;ll be graded
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {rubric.max_score} points, {rubric.pass_score}% to pass.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {Object.entries(rubric.criteria).map(([key, weight]) => (
                        <li
                          key={key}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="capitalize text-muted-foreground">
                            {key.replace(/_/g, " ")}
                          </span>
                          <span className="tabular font-medium">{weight}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {attachments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Attachments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {attachments.map((attachment) => (
                        <li key={attachment.url}>
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm hover:underline"
                          >
                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{attachment.name}</span>
                            <Download className="size-3.5 shrink-0 text-muted-foreground" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {caseData.expected_framework && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Hint</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Reveal suggested structure
                      </summary>
                      <div className="mt-3">
                        <Markdown>{caseData.expected_framework}</Markdown>
                      </div>
                    </details>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* -------------------------------------------------- interview --- */}
        <TabsContent value="interview">
          <div className="mt-4 max-w-4xl">
            <CaseChat caseId={caseData.id} signedIn={Boolean(profile)} />
          </div>
        </TabsContent>

        {/* --------------------------------------------------- solution --- */}
        <TabsContent value="solution">
          {caseData.format === "drill" && drillQuestions.length > 0 ? (
            <div className="mt-4 max-w-3xl">
              <DrillRunner
                caseId={caseData.id}
                caseSlug={caseData.slug}
                questions={drillQuestions}
                signedIn={Boolean(profile)}
              />
            </div>
          ) : caseData.format === "model" && modelCells.length > 0 ? (
            <div className="mt-4 max-w-4xl">
              <ModelWorkspace
                caseId={caseData.id}
                caseSlug={caseData.slug}
                cells={modelCells}
                signedIn={Boolean(profile)}
              />
            </div>
          ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <AnswerEditor
                caseId={caseData.id}
                caseSlug={caseData.slug}
                signedIn={Boolean(profile)}
                storageKey={`casecode:draft:${caseData.id}`}
              />
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Your attempts</CardTitle>
              </CardHeader>
              <CardContent>
                {mySubmissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No attempts yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {mySubmissions.map((submission) => {
                      const score = Array.isArray(submission.scores)
                        ? submission.scores[0]
                        : submission.scores;
                      return (
                        <li key={submission.id} className="space-y-1">
                          <Link
                            href={`/cases/${slug}?submission=${submission.id}`}
                            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                          >
                            <span className="text-muted-foreground">
                              Attempt {submission.attempt_number}
                            </span>
                            <span className="tabular">
                              {score
                                ? `${Number(score.percentage).toFixed(0)}%`
                                : "—"}
                            </span>
                          </Link>
                          {score && (
                            <div className="px-2">
                              <ShareToggle
                                submissionId={submission.id}
                                initialIsPublic={submission.is_public}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
          )}
        </TabsContent>

        {/* ----------------------------------------------- top solutions --- */}
        <TabsContent value="top">
          {!topSolutions || topSolutions.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  No public solutions yet. Solve it, then share yours from the
                  attempts list.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-4">
              {topSolutions.map((solution) => {
                const author = Array.isArray(solution.users)
                  ? solution.users[0]
                  : solution.users;
                const score = Array.isArray(solution.scores)
                  ? solution.scores[0]
                  : solution.scores;
                return (
                  <Card key={solution.id}>
                    <CardHeader className="flex-row items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-[10px]">
                            {initials(author?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {author?.full_name ?? "Anonymous"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {timeAgo(solution.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {score && (
                          <Badge variant="success" className="tabular">
                            {Number(score.percentage).toFixed(0)}%
                          </Badge>
                        )}
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <ArrowBigUp className="size-4" />
                          <span className="tabular">{solution.upvotes}</span>
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Markdown className="text-muted-foreground">
                        {solution.answer}
                      </Markdown>
                    </CardContent>
                  </Card>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* ------------------------------------------------- discussion --- */}
        <TabsContent value="discussion">
          <Card>
            <CardContent className="p-6">
              <Discussion
                caseId={caseData.id}
                comments={comments}
                signedIn={Boolean(profile)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------------------------------------------- review --- */}
        <TabsContent value="hints">
          <div className="mt-4 max-w-3xl">
            <HintsPanel hints={hints} signedIn={Boolean(profile)} />
          </div>
        </TabsContent>

        <TabsContent value="report">
          <Card className="mt-4 max-w-3xl">
            <CardHeader>
              <CardTitle className="text-base">Report a problem</CardTitle>
              <p className="text-sm text-muted-foreground">
                Wrong rubric, ambiguous wording or numbers that do not add up —
                flagging it is how bad cases get found.
              </p>
            </CardHeader>
            <CardContent>
              <ReportForm caseId={caseData.id} signedIn={Boolean(profile)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review">
          {selectedScore && rubric ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ScorePanel score={selectedScore} criteria={rubric.criteria} />
              </div>
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base">Your answer</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
                    <Markdown className="text-muted-foreground">
                      {selected?.answer ?? ""}
                    </Markdown>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  Submit an answer to see your rubric breakdown and feedback.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Renders the case's `supporting_data` JSON as readable tables. */
function SupportingData({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-5">
      {Object.entries(data).map(([key, value]) => {
        const label = key.replace(/_/g, " ");

        if (Array.isArray(value) && typeof value[0] === "object" && value[0]) {
          const columns = Object.keys(value[0] as object);
          return (
            <div key={key}>
              <h3 className="mb-2 text-sm font-medium capitalize">{label}</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th
                          key={column}
                          className="border border-border bg-muted px-3 py-2 text-left font-medium capitalize"
                        >
                          {column.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(value as Record<string, unknown>[]).map((row, index) => (
                      <tr key={index}>
                        {columns.map((column) => (
                          <td
                            key={column}
                            className="border border-border px-3 py-2 tabular"
                          >
                            {String(row[column] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        if (value && typeof value === "object") {
          return (
            <div key={key}>
              <h3 className="mb-2 text-sm font-medium capitalize">{label}</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                {Object.entries(value as Record<string, unknown>).map(
                  ([metric, metricValue]) => (
                    <div key={metric}>
                      <dt className="text-xs capitalize text-muted-foreground">
                        {metric.replace(/_/g, " ")}
                      </dt>
                      <dd className="tabular font-medium">
                        {String(metricValue)}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </div>
          );
        }

        return (
          <div key={key} className="flex justify-between text-sm">
            <span className="capitalize text-muted-foreground">{label}</span>
            <span className="tabular font-medium">{String(value)}</span>
          </div>
        );
      })}
    </div>
  );
}
