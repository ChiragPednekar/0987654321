import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { requireTeacherActor, batchesTaughtBy } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/teacher/empty-state";
import { formatDay, formatNumber } from "@/lib/utils";
import type { ClassroomAssignmentStatsRow } from "@/lib/types/database";
import { ASSIGNMENT_KIND_LABEL } from "@/lib/assignments";

export const metadata: Metadata = { title: "Assignments" };

export default async function AssignmentsPage() {
  const actor = await requireTeacherActor();
  const admin = createAdminClient();
  const ids = await batchesTaughtBy(actor.id);

  if (ids.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No batches yet"
        body="Assignments belong to a batch. Create one first, then set your students some work."
        action={{ href: "/teacher/batches", label: "Create a batch" }}
      />
    );
  }

  const { data: assignments } = await admin
    .from("classroom_assignments")
    .select("id, title, due_at, is_published, max_marks, classroom_id, kind, cases(title), classrooms(name)")
    .in("classroom_id", ids)
    .order("created_at", { ascending: false });

  // Counts per batch, merged — one round trip per batch rather than per row.
  const statsByAssignment = new Map<string, ClassroomAssignmentStatsRow>();
  await Promise.all(
    ids.map(async (cid) => {
      const { data } = await admin.rpc("classroom_assignment_stats", {
        p_classroom: cid,
      });
      for (const row of (data ?? []) as ClassroomAssignmentStatsRow[]) {
        statsByAssignment.set(row.assignment_id, row);
      }
    }),
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-editorial text-[2.6rem] font-normal leading-[1.02] tracking-[-0.02em]">Assignments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you have set, and how much is waiting to be marked.
          </p>
        </div>
        <Button asChild>
          <Link href="/teacher/assignments/new">New assignment</Link>
        </Button>
      </div>

      {!assignments || assignments.length === 0 ? (
        <p className="mt-8 border-t-2 border-foreground pt-4 text-sm text-muted-foreground">
          Nothing set yet. Tick cases, exercises or questions in the library
          and add them to a batch.
        </p>
      ) : (
        // A register, not a card per row: due date, what it is, how many have
        // handed in, and whether anything is waiting on the teacher.
        <div className="mt-8">
          <div className="hidden grid-cols-[4.5rem_1fr_9rem_7rem] gap-4 border-b border-foreground pb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground md:grid">
            <span>Due</span>
            <span>Assignment</span>
            <span>Handed in</span>
            <span className="text-right">Marking</span>
          </div>
          <ul className="divide-y divide-border border-b border-border">
            {assignments.map((a) => {
              const c = Array.isArray(a.cases) ? a.cases[0] : a.cases;
              const room = Array.isArray(a.classrooms) ? a.classrooms[0] : a.classrooms;
              const s = statsByAssignment.get(a.id);
              const enrolled = Number(s?.enrolled ?? 0);
              const submitted = Number(s?.submitted ?? 0);
              const reviewed = Number(s?.reviewed ?? 0);
              const pending = submitted - reviewed;
              const auto = Boolean(a.kind && a.kind !== "case");

              return (
                <li key={a.id}>
                  <Link
                    href={`/teacher/assignments/${a.id}`}
                    className="group grid gap-x-4 gap-y-1.5 py-3.5 md:grid-cols-[4.5rem_1fr_9rem_7rem] md:items-center"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {a.due_at ? formatDay(a.due_at) : "—"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium group-hover:underline">
                        {a.title ?? c?.title ?? "Assignment"}
                        {!a.is_published ? (
                          <Badge variant="outline" className="ml-2 align-middle">Draft</Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {room?.name}
                        {" · "}
                        {ASSIGNMENT_KIND_LABEL[(a.kind ?? "case") as keyof typeof ASSIGNMENT_KIND_LABEL]}
                        {a.max_marks ? ` · out of ${a.max_marks}` : " · practice"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Progress
                        value={enrolled ? (submitted / enrolled) * 100 : 0}
                        className="h-1 flex-1"
                      />
                      <span className="w-12 shrink-0 text-right font-mono text-xs tabular">
                        {formatNumber(submitted)}/{formatNumber(enrolled)}
                      </span>
                    </span>
                    <span className="text-xs md:text-right">
                      {auto ? (
                        <span className="text-muted-foreground">by the platform</span>
                      ) : pending > 0 ? (
                        <Badge variant="warning">{pending} to mark</Badge>
                      ) : submitted > 0 ? (
                        <span className="text-muted-foreground">all marked</span>
                      ) : (
                        <span className="hidden text-subtle-foreground md:inline">—</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
