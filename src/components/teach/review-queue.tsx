"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Clock, Loader2 } from "lucide-react";
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
export function ReviewQueue({
  assignmentId,
  maxMarks,
  rows,
}: {
  assignmentId: string;
  maxMarks: number | null;
  rows: AssignmentReviewRow[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function save(studentId: string, form: HTMLFormElement) {
    const f = new FormData(form);
    const rawMarks = String(f.get("marks") ?? "").trim();
    const remarks = String(f.get("remarks") ?? "").trim();

    if (!rawMarks && !remarks) {
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
          }),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error ?? "Could not save.");
        return;
      }
      toast.success("Saved — the student has been notified.");
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

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
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
                  ) : notStarted ? null : (
                    <Badge variant="warning" className="shrink-0">
                      <Clock className="mr-1 size-3" />
                      to mark
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
                      <p className="mt-3 text-sm text-muted-foreground tabular">
                        AI grade: {row.ai_score}/{row.ai_max} (
                        {Number(row.ai_percentage).toFixed(1)}%) — advisory only.
                        Your mark is the one that counts.
                      </p>
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

                      <Button type="submit" size="sm" disabled={busy === row.user_id}>
                        {busy === row.user_id ? (
                          <Loader2 className="animate-spin" />
                        ) : null}
                        {reviewed ? "Update" : "Save and notify"}
                      </Button>
                    </form>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
