"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Clock, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { cn, timeAgo } from "@/lib/utils";
import type { AssignmentReviewRow } from "@/lib/types/database";

/**
 * The marking queue.
 *
 * One student expanded at a time: marking is a sequential task, and a page of
 * simultaneously open essays is harder to work through, not easier. Students
 * who have not submitted are listed too — they are the ones a teacher most
 * needs to see, and hiding them would make the class look complete.
 */
type Filter =
  | "all" | "not_started" | "submitted" | "ai_graded"
  | "awaiting" | "reviewed" | "resubmission_requested";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "not_started", label: "Not started" },
  { value: "awaiting", label: "Awaiting review" },
  { value: "ai_graded", label: "AI graded" },
  { value: "reviewed", label: "Reviewed" },
  { value: "resubmission_requested", label: "Resubmission requested" },
];

export function ReviewQueue({
  assignmentId,
  maxMarks,
  allowResubmission = true,
  rows,
}: {
  assignmentId: string;
  maxMarks: number | null;
  /** Hides the send-back action when the assignment forbids another attempt. */
  allowResubmission?: boolean;
  rows: AssignmentReviewRow[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");

  async function save(
    studentId: string,
    form: HTMLFormElement,
    requestResubmission = false,
  ) {
    const f = new FormData(form);
    const rawMarks = String(f.get("marks") ?? "").trim();
    const remarks = String(f.get("remarks") ?? "").trim();

    // Sending work back without saying why is not feedback.
    if (requestResubmission && !remarks) {
      toast.error("Say what needs changing before sending it back.");
      return;
    }
    if (!requestResubmission && !rawMarks && !remarks) {
      toast.error("Add a mark or a remark before saving.");
      return;
    }

    setBusy(studentId);
    try {
      const response = await fetch(
        `/api/classrooms/assignments/${assignmentId}/review`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            student_id: studentId,
            marks: rawMarks === "" ? null : Number(rawMarks),
            remarks: remarks || null,
            request_resubmission: requestResubmission,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? "Could not save.");
        return;
      }
      toast.success(
        requestResubmission
          ? "Sent back — the student has been notified."
          : "Saved — the student has been notified.",
      );
      setOpenId(null);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Nobody has joined this batch yet. Share the join code with your
          students.
        </CardContent>
      </Card>
    );
  }

  const visible = rows.filter((row) => {
    const matchesQuery =
      !query.trim() ||
      `${row.full_name ?? ""} ${row.email}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    if (!matchesQuery) return false;

    switch (filter) {
      case "all": return true;
      case "not_started": return !row.submitted_at;
      // "Awaiting" is the working queue: handed in and not yet marked,
      // whether or not the AI has finished.
      case "awaiting":
        return row.submitted_at && (row.status === "submitted" || row.status === "ai_graded");
      default: return row.status === filter;
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count =
            f.value === "all"
              ? rows.length
              : f.value === "not_started"
                ? rows.filter((r) => !r.submitted_at).length
                : f.value === "awaiting"
                  ? rows.filter((r) => r.submitted_at && (r.status === "submitted" || r.status === "ai_graded")).length
                  : rows.filter((r) => r.status === f.value).length;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filter === f.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span className="ml-1.5 tabular opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or email…"
        aria-label="Search students"
        className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {visible.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nothing matches this filter.
          </CardContent>
        </Card>
      ) : null}

    <ul className="space-y-3">
      {visible.map((row) => {
        const open = openId === row.user_id;
        const notStarted = !row.submitted_at;
        const reviewed = row.status === "reviewed";

        return (
          <li key={row.user_id}>
            <Card className={cn(notStarted && "opacity-70")}>
              <CardContent className="p-0">
                <button
                  type="button"
                  disabled={notStarted}
                  onClick={() => setOpenId(open ? null : row.user_id)}
                  aria-expanded={open}
                  className={cn(
                    "flex w-full items-center gap-3 p-4 text-left",
                    !notStarted && "hover:bg-accent/40",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {row.full_name ?? "Unnamed"}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {row.email}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {notStarted
                        ? "not started"
                        : `submitted ${timeAgo(row.submitted_at!)}`}
                      {row.is_late ? " · late" : ""}
                      {row.attempt_number > 1 ? ` · attempt ${row.attempt_number}` : ""}
                    </p>
                  </div>

                  {row.ai_percentage !== null ? (
                    <span className="hidden shrink-0 text-sm text-muted-foreground tabular sm:block">
                      AI {Number(row.ai_percentage).toFixed(0)}%
                    </span>
                  ) : null}

                  {reviewed ? (
                    <Badge variant="secondary" className="shrink-0">
                      <CheckCircle2 className="mr-1 size-3" />
                      {row.faculty_marks !== null
                        ? `${row.faculty_marks}${maxMarks ? `/${maxMarks}` : ""}`
                        : "reviewed"}
                    </Badge>
                  ) : row.status === "resubmission_requested" ? (
                    <Badge variant="outline" className="shrink-0">
                      <RotateCcw className="mr-1 size-3" />
                      sent back
                    </Badge>
                  ) : notStarted ? null : (
                    <Badge variant="warning" className="shrink-0">
                      <Clock className="mr-1 size-3" />
                      {row.status === "ai_graded" ? "to mark" : "grading"}
                    </Badge>
                  )}

                  {!notStarted ? (
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  ) : null}
                </button>

                {open ? (
                  <div className="border-t border-border p-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Their answer
                    </p>
                    <div className="max-h-96 overflow-y-auto rounded-md bg-muted/40 p-3 text-sm">
                      {row.answer ? (
                        <Markdown>{row.answer}</Markdown>
                      ) : (
                        <p className="text-muted-foreground">
                          The answer is no longer available.
                        </p>
                      )}
                    </div>

                    {row.ai_score !== null ? (
                      <div className="mt-3 rounded-md border border-border p-3">
                        <p className="text-sm text-muted-foreground tabular">
                          AI grade: {row.ai_score}/{row.ai_max} (
                          {Number(row.ai_percentage).toFixed(1)}%) — advisory
                          only. Your mark is the one that counts.
                        </p>

                        {/*
                          The per-criterion split and the written feedback were
                          already stored on every score; the review queue simply
                          never returned them, so a teacher saw one number with
                          no way to tell where it came from. Marking against a
                          rubric you cannot see is most of the value gone.
                        */}
                        {row.ai_breakdown &&
                        Object.keys(row.ai_breakdown).length > 0 ? (
                          <ul className="mt-3 space-y-1">
                            {Object.entries(row.ai_breakdown).map(
                              ([key, points]) => (
                                <li
                                  key={key}
                                  className="flex items-baseline justify-between gap-3 text-sm"
                                >
                                  <span className="capitalize text-muted-foreground">
                                    {key.replace(/_/g, " ")}
                                  </span>
                                  <span className="tabular">{points}</span>
                                </li>
                              ),
                            )}
                          </ul>
                        ) : null}

                        {row.ai_feedback ? (
                          <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                            {(
                              [
                                ["Strengths", row.ai_feedback.strengths],
                                ["Gaps", row.ai_feedback.weaknesses],
                                ["Next time", row.ai_feedback.improvements],
                              ] as const
                            ).map(([label, items]) =>
                              items && items.length > 0 ? (
                                <div key={label}>
                                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    {label}
                                  </p>
                                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                                    {items.map((item, i) => (
                                      <li key={i}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null,
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Submitted but not yet graded by the AI.
                      </p>
                    )}

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void save(row.user_id, e.currentTarget);
                      }}
                      className="mt-4 space-y-3"
                    >
                      {maxMarks !== null ? (
                        <div className="max-w-40">
                          <Label htmlFor={`marks-${row.user_id}`}>
                            Marks (out of {maxMarks})
                          </Label>
                          <Input
                            id={`marks-${row.user_id}`}
                            name="marks"
                            type="number"
                            step="0.5"
                            min={0}
                            max={maxMarks}
                            defaultValue={row.faculty_marks ?? ""}
                          />
                        </div>
                      ) : null}

                      <div>
                        <Label htmlFor={`remarks-${row.user_id}`}>Remarks</Label>
                        <Textarea
                          id={`remarks-${row.user_id}`}
                          name="remarks"
                          rows={4}
                          maxLength={4000}
                          defaultValue={row.faculty_remarks ?? ""}
                          placeholder="What they did well, and the one thing to fix next time…"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" size="sm" disabled={busy === row.user_id}>
                          {busy === row.user_id ? (
                            <Loader2 className="animate-spin" />
                          ) : null}
                          {reviewed ? "Update" : "Save and notify"}
                        </Button>
                        {allowResubmission ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy === row.user_id}
                            onClick={(e) => {
                              const form = (e.currentTarget as HTMLElement).closest("form");
                              if (form) void save(row.user_id, form, true);
                            }}
                          >
                            <RotateCcw className="size-4" />
                            Ask for another attempt
                          </Button>
                        ) : null}
                      </div>
                    </form>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
    </div>
  );
}
