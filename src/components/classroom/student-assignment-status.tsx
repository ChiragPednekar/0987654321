import { CheckCircle2, Clock, CircleDashed, RotateCcw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * A student's own status on one assignment.
 *
 * Five states, because they call for different actions: not started (go do it),
 * submitted (wait), AI graded (wait, but you can already read the AI feedback),
 * sent back (do it again — and here is why), reviewed (read the mark).
 *
 * "Sent back" previously fell through to "Submitted", so the one state that
 * asks the student to do something looked exactly like the one that asks them
 * to wait — and the teacher's reason for sending it back was hidden, because
 * remarks only rendered on `reviewed`. The notification said "Resubmission
 * requested" and the classroom page disagreed with it.
 */
export function StudentAssignmentStatus({
  work,
  maxMarks,
}: {
  work: {
    status: string;
    faculty_marks: number | null;
    faculty_remarks: string | null;
    is_late: boolean;
  } | null;
  maxMarks: number | null;
}) {
  if (!work) {
    return (
      <Badge variant="outline" className="gap-1">
        <CircleDashed className="size-3" />
        Not started
      </Badge>
    );
  }

  if (work.status === "resubmission_requested") {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Badge variant="destructive" className="gap-1">
          <RotateCcw className="size-3" />
          Another attempt needed
        </Badge>
        {work.faculty_remarks ? (
          <span className="text-xs text-muted-foreground">
            “{work.faculty_remarks.slice(0, 160)}
            {work.faculty_remarks.length > 160 ? "…" : ""}”
          </span>
        ) : null}
      </span>
    );
  }

  if (work.status === "ai_graded") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Sparkles className="size-3" />
        AI graded — awaiting your teacher
      </Badge>
    );
  }

  if (work.status !== "reviewed") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="size-3" />
        Submitted{work.is_late ? " (late)" : ""}
      </Badge>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="size-3" />
        {work.faculty_marks !== null
          ? `${work.faculty_marks}${maxMarks ? `/${maxMarks}` : ""}`
          : "Reviewed"}
      </Badge>
      {work.faculty_remarks ? (
        <span className="text-xs text-muted-foreground">
          “{work.faculty_remarks.slice(0, 120)}
          {work.faculty_remarks.length > 120 ? "…" : ""}”
        </span>
      ) : null}
    </span>
  );
}
