import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CalendarClock, ClipboardCheck, GraduationCap, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatNumber } from "@/lib/utils";
import type { ClassroomAssignmentStatsRow } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Teaching",
  description: "Your batches, assignments and everything waiting to be marked.",
};

export default async function TeachPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/teach");

  const admin = createAdminClientOrNull();
  if (!admin) redirect("/classrooms");

  // Only classrooms where this person is the teacher.
  const { data: teaching } = await admin
    .from("classroom_members")
    .select("classroom_id, classrooms(id, name, description, join_code, archived)")
    .eq("user_id", profile.id)
    .eq("role", "teacher");

  if (!teaching || teaching.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <GraduationCap className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Teaching</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          You are not teaching a batch yet. Create one and share its join code
          with your students — they enter it once and they are in.
        </p>
        <Link
          href="/classrooms"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Create a batch
        </Link>
      </div>
    );
  }

  const rooms = teaching
    .map((t) => (Array.isArray(t.classrooms) ? t.classrooms[0] : t.classrooms))
    .filter(Boolean) as {
    id: string;
    name: string;
    description: string | null;
    join_code: string;
    archived: boolean;
  }[];

  // Assignments and their counts, per batch.
  const blocks = await Promise.all(
    rooms.map(async (room) => {
      const [{ data: assignments }, { data: stats }, { count: roster }] =
        await Promise.all([
          admin
            .from("classroom_assignments")
            .select("id, due_at, note, max_marks, cases(slug, title)")
            .eq("classroom_id", room.id)
            .order("due_at", { ascending: true, nullsFirst: false }),
          admin.rpc("classroom_assignment_stats", { p_classroom: room.id }),
          admin
            .from("classroom_members")
            .select("user_id", { count: "exact", head: true })
            .eq("classroom_id", room.id)
            .eq("role", "student"),
        ]);

      const byId = new Map(
        ((stats ?? []) as ClassroomAssignmentStatsRow[]).map((s) => [
          s.assignment_id,
          s,
        ]),
      );

      return { room, assignments: assignments ?? [], byId, roster: roster ?? 0 };
    }),
  );

  const toMark = blocks.reduce(
    (total, b) =>
      total +
      b.assignments.reduce((n, a) => {
        const s = b.byId.get(a.id);
        return n + (Number(s?.submitted ?? 0) - Number(s?.reviewed ?? 0));
      }, 0),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teaching</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your batches and everything waiting to be marked.
          </p>
        </div>
        {toMark > 0 ? (
          <Badge variant="warning" className="text-sm">
            <ClipboardCheck className="mr-1 size-3.5" />
            {formatNumber(toMark)} to mark
          </Badge>
        ) : null}
      </div>

      <div className="mt-8 space-y-6">
        {blocks.map(({ room, assignments, byId, roster }) => (
          <Card key={room.id}>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{room.name}</CardTitle>
                <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 tabular">
                    <Users className="size-3.5" />
                    {formatNumber(roster)} students
                  </span>
                  <span className="font-mono">code {room.join_code}</span>
                </p>
              </div>
              <Link
                href={`/classrooms/${room.id}`}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Manage batch →
              </Link>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No assignments set yet.
                </p>
              ) : (
                <ul className="space-y-4">
                  {assignments.map((a) => {
                    const c = Array.isArray(a.cases) ? a.cases[0] : a.cases;
                    const s = byId.get(a.id);
                    const submitted = Number(s?.submitted ?? 0);
                    const reviewed = Number(s?.reviewed ?? 0);
                    const pending = submitted - reviewed;
                    const overdue =
                      a.due_at && new Date(a.due_at) < new Date();

                    return (
                      <li key={a.id}>
                        <Link
                          href={`/teach/${a.id}`}
                          className="group block rounded-md border border-border p-3 transition-colors hover:border-primary/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium group-hover:underline">
                              {c?.title ?? "Case"}
                            </span>
                            <div className="flex items-center gap-2">
                              {pending > 0 ? (
                                <Badge variant="warning">
                                  {pending} to mark
                                </Badge>
                              ) : submitted > 0 ? (
                                <Badge variant="secondary">All marked</Badge>
                              ) : null}
                              {a.max_marks ? (
                                <span className="text-xs text-muted-foreground tabular">
                                  out of {a.max_marks}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  practice
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 flex items-center gap-3">
                            <Progress
                              value={roster ? (submitted / roster) * 100 : 0}
                              className="flex-1"
                            />
                            <span className="w-24 shrink-0 text-right text-xs text-muted-foreground tabular">
                              {submitted} / {roster} in
                            </span>
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {a.due_at ? (
                              <span
                                className={cn(
                                  "flex items-center gap-1",
                                  overdue && "text-amber-600 dark:text-amber-400",
                                )}
                              >
                                <CalendarClock className="size-3.5" />
                                due {new Date(a.due_at).toLocaleDateString()}
                              </span>
                            ) : null}
                            {s?.avg_ai !== null && s?.avg_ai !== undefined ? (
                              <span className="tabular">
                                AI average {Number(s.avg_ai).toFixed(1)}%
                              </span>
                            ) : null}
                            {s?.avg_marks !== null && s?.avg_marks !== undefined ? (
                              <span className="tabular">
                                your average {Number(s.avg_marks).toFixed(1)}
                              </span>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
