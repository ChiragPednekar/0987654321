import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { requireTeacherActor, batchesTaughtBy } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/teacher/empty-state";
import { formatNumber } from "@/lib/utils";
import type { ClassroomAssignmentStatsRow } from "@/lib/types/database";

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
    .select("id, title, due_at, is_published, max_marks, classroom_id, cases(title), classrooms(name)")
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
          <h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you have set, and how much is waiting to be marked.
          </p>
        </div>
        <Button asChild>
          <Link href="/teacher/assignments/new">New assignment</Link>
        </Button>
      </div>

      {!assignments || assignments.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nothing set yet. Create an assignment for your students.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {assignments.map((a) => {
            const c = Array.isArray(a.cases) ? a.cases[0] : a.cases;
            const room = Array.isArray(a.classrooms) ? a.classrooms[0] : a.classrooms;
            const s = statsByAssignment.get(a.id);
            const enrolled = Number(s?.enrolled ?? 0);
            const submitted = Number(s?.submitted ?? 0);
            const reviewed = Number(s?.reviewed ?? 0);
            const pending = submitted - reviewed;

            return (
              <li key={a.id}>
                <Link
                  href={`/teacher/assignments/${a.id}`}
                  className="group block rounded-md border border-border p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium group-hover:underline">
                      {a.title ?? c?.title ?? "Assignment"}
                    </span>
                    <div className="flex items-center gap-2">
                      {!a.is_published ? <Badge variant="outline">Draft</Badge> : null}
                      {pending > 0 ? (
                        <Badge variant="warning">{pending} to mark</Badge>
                      ) : submitted > 0 ? (
                        <Badge variant="secondary">All marked</Badge>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {room?.name}
                    {a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString()}` : ""}
                    {a.max_marks ? ` · out of ${a.max_marks}` : " · practice"}
                  </p>

                  <div className="mt-3 flex items-center gap-3">
                    <Progress
                      value={enrolled ? (submitted / enrolled) * 100 : 0}
                      className="flex-1"
                    />
                    <span className="w-24 shrink-0 text-right text-xs text-muted-foreground tabular">
                      {formatNumber(submitted)} / {formatNumber(enrolled)} in
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
