import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PullToggle } from "@/components/admin/pull-toggle";

export const metadata: Metadata = { title: "Daily quiz · Admin" };

/**
 * Every recent daily question with its answer, the quote it rests on and the
 * release it came from, so a wrong one can be spotted and pulled in a glance.
 * The admin layout guards this page.
 */
export default async function AdminCurrentAffairsPage() {
  const admin = createAdminClient();
  const { data: quizzes } = await admin
    .from("ca_quizzes")
    .select("id, quiz_date, model")
    .order("quiz_date", { ascending: false })
    .limit(10);

  const ids = (quizzes ?? []).map((q) => q.id);
  const [{ data: questions }, { data: attempts }] = ids.length
    ? await Promise.all([
        admin
          .from("ca_questions")
          .select("id, quiz_id, position, stem, options, correct_index, evidence, is_pulled, source_item_id")
          .in("quiz_id", ids)
          .order("position"),
        admin.from("ca_attempts").select("quiz_id").in("quiz_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const sourceIds = [...new Set((questions ?? []).map((q) => q.source_item_id))];
  const { data: sources } = sourceIds.length
    ? await admin.from("ca_source_items").select("id, title, url").in("id", sourceIds)
    : { data: [] };
  const sourceOf = new Map((sources ?? []).map((s) => [s.id, s]));

  const attemptsOf = new Map<string, number>();
  for (const a of attempts ?? []) attemptsOf.set(a.quiz_id, (attemptsOf.get(a.quiz_id) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Daily quiz</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Written each morning from RBI press releases. Every question has already passed an
          automatic check that its quote is in the release and its answer&apos;s figures are
          too — but a question can be grounded and still be poor. Pulling one removes it from
          every student&apos;s score, including past attempts.
        </p>
      </div>

      {(quizzes ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">No quizzes yet.</p>
      )}

      {(quizzes ?? []).map((quiz) => (
        <div key={quiz.id} className="space-y-2">
          <p className="text-sm font-medium">
            {quiz.quiz_date}{" "}
            <span className="font-normal text-muted-foreground">
              · {attemptsOf.get(quiz.id) ?? 0} attempts · {quiz.model}
            </span>
          </p>
          {(questions ?? [])
            .filter((q) => q.quiz_id === quiz.id)
            .map((q) => {
              const source = sourceOf.get(q.source_item_id);
              return (
                <Card key={q.id} className={q.is_pulled ? "opacity-60" : undefined}>
                  <CardContent className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0 space-y-1.5 text-sm">
                      <p className="font-medium">
                        {q.position + 1}. {q.stem}{" "}
                        {q.is_pulled && <Badge variant="outline">Pulled</Badge>}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Answer: </span>
                        {q.options[q.correct_index]}
                        <span className="text-muted-foreground">
                          {" "}· others: {q.options.filter((_, i) => i !== q.correct_index).join(" / ")}
                        </span>
                      </p>
                      <blockquote className="border-l-2 pl-2 text-xs italic text-muted-foreground">
                        “{q.evidence}”
                      </blockquote>
                      {source && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
                        >
                          {source.title}
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    <PullToggle questionId={q.id} pulled={q.is_pulled} />
                  </CardContent>
                </Card>
              );
            })}
        </div>
      ))}
    </div>
  );
}
