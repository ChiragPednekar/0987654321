import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Lock,
  Megaphone,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssignCaseForm } from "@/components/classroom/assign-case-form";
import { StudentAssignmentStatus } from "@/components/classroom/student-assignment-status";
import { JoinBatchModal } from "@/components/classroom/join-batch-modal";
import { DIFFICULTY_CLASS, DOMAIN_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Difficulty, Domain } from "@/lib/types/database";

export const metadata: Metadata = { title: "Classroom Batch" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClassroomPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await getCurrentUser();
  if (!profile) redirect(`/login?next=/classrooms/${id}`);

  const admin = createAdminClient();

  const { data: room } = await admin
    .from("classrooms")
    .select("id, name, description, join_code, owner_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!room) notFound();

  // Fetch teacher/instructor info
  const { data: teacher } = await admin
    .from("users")
    .select("full_name, email")
    .eq("id", room.owner_id)
    .maybeSingle();

  const instructorName = teacher?.full_name ?? "Lead Instructor";

  // Check user's membership
  const { data: membership } = await admin
    .from("classroom_members")
    .select("role")
    .eq("classroom_id", id)
    .eq("user_id", profile.id)
    .maybeSingle();

  const isTeacher = membership?.role === "teacher" || room.owner_id === profile.id;
  const isEnrolled = Boolean(membership) || isTeacher;

  // If user is not yet enrolled in this batch, show preview & join gate
  if (!isEnrolled) {
    const [{ count: studentCount }, { count: assignCount }] = await Promise.all([
      admin
        .from("classroom_members")
        .select("*", { count: "exact", head: true })
        .eq("classroom_id", id),
      admin
        .from("classroom_assignments")
        .select("*", { count: "exact", head: true })
        .eq("classroom_id", id),
    ]);

    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Link
          href="/classrooms"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All classrooms & batches
        </Link>

        <Card className="mt-6 border-border/80 shadow-md">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-500">
                <Lock className="size-3" />
                Private Cohort Batch
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold">{room.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Instructor: <span className="font-semibold text-foreground">{instructorName}</span>
            </p>
            {room.description ? (
              <p className="text-sm text-muted-foreground pt-1">{room.description}</p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-border/60 bg-muted/40 p-4 text-center">
              <div>
                <span className="text-xs text-muted-foreground">Enrolled Students</span>
                <p className="text-xl font-bold text-foreground">{studentCount ?? 0}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Teacher Assignments</span>
                <p className="text-xl font-bold text-foreground">{assignCount ?? 0}</p>
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3 text-center">
              <GraduationCap className="size-8 text-primary mx-auto" />
              <h3 className="font-semibold text-foreground">Join this Batch to Access Materials</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                This batch is reserved for enrolled students. Enter the 6-character batch code provided by {instructorName} to view all case assignments, feedback, and handouts.
              </p>
              <div className="pt-2 flex justify-center">
                <JoinBatchModal batchName={room.name} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is enrolled (or is teacher) -> fetch all batch data
  const [
    { data: roster },
    { data: assignments },
    { data: myWork },
  ] = await Promise.all([
    admin
      .from("classroom_members")
      .select("user_id, role, joined_at, users(full_name, cases_solved, ce)")
      .eq("classroom_id", id),
    admin
      .from("classroom_assignments")
      .select("id, due_at, note, max_marks, cases(slug, title, domain, difficulty)")
      .eq("classroom_id", id)
      .order("due_at", { ascending: true }),
    admin
      .from("assignment_submissions")
      .select("assignment_id, status, faculty_marks, faculty_remarks, is_late, submitted_at")
      .eq("user_id", profile.id),
  ]);

  const mine = new Map((myWork ?? []).map((w) => [w.assignment_id, w]));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-8">
      <div>
        <Link
          href="/classrooms"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          ← Back to classrooms & batches
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{room.name}</h1>
              {isTeacher ? (
                <Badge variant="secondary" className="text-xs">Teacher</Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">Enrolled Student</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Instructor: <span className="font-semibold text-foreground">{instructorName}</span>
            </p>
            {room.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{room.description}</p>
            ) : null}
            {isTeacher ? (
              <div className="pt-1">
                <span className="font-mono text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded border border-primary/20">
                  Batch Join Code: {room.join_code}
                </span>
              </div>
            ) : null}
          </div>
          {isTeacher ? <AssignCaseForm classroomId={room.id} /> : null}
        </div>
      </div>

      {/* 1. Teacher's Batch Announcement & Guidance */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Megaphone className="size-4" />
            <span>Instructor Guidance & Weekly Focus</span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            Welcome to {room.name}. Complete all assigned case drills prior to their due dates. Remember to focus on structured hypotheses, quantitative sanity checks, and clear answer-first executive syntheses during your drills.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              Direct faculty review & AI rubric feedback enabled
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Teacher's Assigned Cases */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Assigned Cases & Problem Sets ({assignments?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!assignments || assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {isTeacher
                ? "You haven't assigned any cases to this batch yet. Use the 'Assign case' button above."
                : "No cases assigned yet by your instructor. Check back soon!"}
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {assignments.map((row) => {
                const c = Array.isArray(row.cases) ? row.cases[0] : row.cases;
                if (!c) return null;
                const submission = mine.get(row.id);

                return (
                  <li key={row.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/cases/${c.slug}`}
                          className="font-semibold text-foreground hover:underline"
                        >
                          {c.title}
                        </Link>
                        <Badge variant="outline" className="text-[11px]">{DOMAIN_LABEL[c.domain as Domain]}</Badge>
                        <span
                          className={cn("text-xs font-medium", DIFFICULTY_CLASS[c.difficulty as Difficulty])}
                        >
                          {c.difficulty}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {row.due_at ? (
                          <span className="flex items-center gap-1 text-amber-500 font-medium">
                            <CalendarClock className="size-3.5" />
                            Due {new Date(row.due_at).toLocaleDateString()}
                          </span>
                        ) : null}
                        {row.max_marks ? (
                          <span className="tabular font-medium">
                            Max marks: {row.max_marks}
                          </span>
                        ) : null}
                        {row.note ? (
                          <span className="italic text-foreground/80">&ldquo;{row.note}&rdquo;</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      {isTeacher ? (
                        <Link
                          href={`/teach/${row.id}`}
                          className="text-xs font-semibold text-primary underline underline-offset-4"
                        >
                          Review submissions
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2">
                          <StudentAssignmentStatus
                            work={submission ?? null}
                            maxMarks={row.max_marks ? Number(row.max_marks) : null}
                          />
                          <Link
                            href={`/cases/${c.slug}`}
                            className="inline-flex items-center rounded-md border border-border bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            Solve Case →
                          </Link>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 3. Batch Handouts & Teacher Materials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            Batch Handouts & Teacher Materials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileSpreadsheet className="size-4 text-primary" />
                <span>Evaluation Rubric & Grading Standard</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Official 5-dimension rubric used by faculty: Problem Definition (20%), MECE Structuring (30%), Quantitative Rigor (25%), and Executive Synthesis (25%).
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                <CheckCircle2 className="size-3.5" />
                Active for this batch
              </div>
            </div>

            <div className="rounded-lg border border-border/70 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BookOpen className="size-4 text-primary" />
                <span>Peer Mock Interview Pairing Guidelines</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Partner casing protocols for cohort members: 45-minute alternating simulations, quantitative drills, and immediate structured debriefs.
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                <CheckCircle2 className="size-3.5" />
                Instructor approved
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Batch Roster */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              Batch Roster
            </span>
            <span className="text-sm font-normal text-muted-foreground tabular">
              {roster?.length ?? 0} members
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Member</th>
                  <th className="py-2 font-medium">Role</th>
                  <th className="py-2 text-right font-medium">Cases Solved</th>
                  <th className="py-2 text-right font-medium">CE Score</th>
                </tr>
              </thead>
              <tbody>
                {(roster ?? []).map((row) => {
                  const u = Array.isArray(row.users) ? row.users[0] : row.users;
                  return (
                    <tr key={row.user_id} className="border-b border-border last:border-0">
                      <td className="py-2.5 font-medium text-foreground">{u?.full_name ?? "Anonymous"}</td>
                      <td className="py-2.5 text-xs text-muted-foreground capitalize">{row.role}</td>
                      <td className="py-2.5 text-right tabular text-xs">{u?.cases_solved ?? 0}</td>
                      <td className="py-2.5 text-right tabular text-xs font-semibold text-primary">{u?.ce ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

