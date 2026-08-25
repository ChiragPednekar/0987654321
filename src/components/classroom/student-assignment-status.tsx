import { CheckCircle2, Clock, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * A student's own status on one assignment.
 *
 * Three states worth distinguishing, because they call for different actions:
 * not started (go do it), submitted (wait), reviewed (read the remarks).
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
