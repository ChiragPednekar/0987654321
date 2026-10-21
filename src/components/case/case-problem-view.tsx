"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Download, FileText, Lock } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCaseProctor } from "@/components/case/case-proctor-shell";
import type { Attachment, RubricCriteria } from "@/lib/types/database";
import { orderedEntries } from "@/lib/supporting-data";

interface CaseProblemViewProps {
  rubric: { criteria: RubricCriteria; max_score: number; pass_score: number } | null;
  nextCase: { slug: string; title: string } | null;
  pathQuery?: string;
}

export function CaseProblemView({
  rubric,
  nextCase,
  pathQuery,
}: CaseProblemViewProps) {
  const caseProctor = useCaseProctor();
  const question = caseProctor?.question;

  if (!question) {
    return (
      <Card className="border-dashed bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-medium">Question Hidden Before Start</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            To ensure exam integrity, the scenario, supporting data, and task instructions are
            held securely on the server and revealed once proctoring begins. Click &quot;Start&quot; above to begin.
          </p>
        </CardContent>
      </Card>
    );
  }

  const attachments = (question.attachments ?? []) as Attachment[];
  const supportingData = question.supporting_data as Record<string, unknown> | undefined;
  const hasSupportingData =
    supportingData && Object.keys(supportingData).length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scenario</CardTitle>
          </CardHeader>
          <CardContent>
            <Markdown className="prose-document">{question.scenario}</Markdown>
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
          <CardContent className="space-y-4">
            <Markdown className="prose-document">{question.instructions}</Markdown>
            {nextCase && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">
                  Ready to move forward? Up next:{" "}
                  <strong className="text-foreground">{nextCase.title}</strong>
                </span>
                <Button size="sm" asChild variant="outline">
                  <Link href={`/cases/${nextCase.slug}${pathQuery ? `?path=${pathQuery}` : ""}`}>
                    Next question <ChevronRight className="ml-1 size-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {rubric && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How you&apos;ll be graded</CardTitle>
              <p className="text-sm text-muted-foreground">
                {rubric.max_score} points, {rubric.pass_score}% to pass.
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {Object.entries(rubric.criteria).map(([key, weight]) => (
                  <li key={key} className="flex items-center justify-between text-sm">
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

        {question.expected_framework && (
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
                  <Markdown>{question.expected_framework}</Markdown>
                </div>
              </details>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Renders the case's `supporting_data` JSON as readable tables. */
export function SupportingData({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-5">
      {orderedEntries(data).map(([key, value]) => {
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
