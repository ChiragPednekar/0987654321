import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { FileText, GraduationCap, Sparkles, Users } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClassroomForms } from "@/components/classroom/classroom-forms";
import { JoinBatchModal } from "@/components/classroom/join-batch-modal";
import { plural } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Classrooms & Batches",
  description: "Cohort batches, teacher assignments, and public faculty resources on CaseCode.",
};

export default async function ClassroomsPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/classrooms");

  const supabase = await createClient();
  const admin = createAdminClient();

  // 1. Fetch current user's memberships
  const { data: memberships } = await supabase
    .from("classroom_members")
    .select("classroom_id, role")
    .eq("user_id", profile.id);

  const roleFor = new Map((memberships ?? []).map((m) => [m.classroom_id, m.role]));
  const enrolledIds = new Set((memberships ?? []).map((m) => m.classroom_id));

  // 2. Fetch all batches on the platform via admin client so all students can discover them
  const [{ data: allBatches }, { data: memberCounts }, { data: assignmentCounts }, { data: teachers }] =
    await Promise.all([
      admin
        .from("classrooms")
        .select("id, name, description, join_code, owner_id, created_at")
        .order("created_at", { ascending: false }),
      admin
        .from("classroom_members")
        .select("classroom_id"),
      admin
        .from("classroom_assignments")
        .select("classroom_id"),
      admin
        .from("users")
        .select("id, full_name, email"),
    ]);

  /**
   * What teachers have chosen to share with the whole platform.
   *
   * Real rows, not a fixture. This section previously rendered six hard-coded
   * articles attributed to invented people ("Prof. Sarah Lin", "Former McKinsey
   * & Company Associate Partner") whose recommended cases linked to slugs that
   * do not exist — every link a 404. Presenting fabricated credentials as
   * faculty output is not something to ship, and it answered a different
   * question from the one asked: the ask was that work a teacher publishes
   * openly reaches everyone, which needs a query, not a constant.
   *
   * `is_public` is set by the teacher on the assignment. The row policy allows
   * the read platform-wide; membership still governs everything else, so
   * nobody outside the batch can submit to it or appear in its review queue.
   */
  const { data: publicAssignments } = await admin
    .from("classroom_assignments")
    .select(
      "id, title, instructions, created_at, classroom_id, created_by, cases(slug, title, domain, difficulty)",
    )
    .eq("is_public", true)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(24);

  // Aggregate member counts per batch
  const countMap = new Map<string, number>();
  (memberCounts ?? []).forEach((row) => {
    countMap.set(row.classroom_id, (countMap.get(row.classroom_id) ?? 0) + 1);
  });

  // Aggregate assignment counts per batch
  const assignCountMap = new Map<string, number>();
  (assignmentCounts ?? []).forEach((row) => {
    assignCountMap.set(row.classroom_id, (assignCountMap.get(row.classroom_id) ?? 0) + 1);
  });

  // Teacher lookup map
  const teacherMap = new Map<string, string>();
  (teachers ?? []).forEach((t) => {
    if (t.full_name) teacherMap.set(t.id, t.full_name);
  });

  const batches = allBatches ?? [];
  const myBatches = batches.filter((b) => enrolledIds.has(b.id) || b.owner_id === profile.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-12">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="size-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Classrooms & Batches</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Instructor-led cohorts, case assignments, and open faculty framework guides.
          </p>
        </div>
        <ClassroomForms />
      </div>

      {/* 1. My Enrolled Batches */}
      {myBatches.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <GraduationCap className="size-4 text-primary" />
              My Enrolled Batches ({myBatches.length})
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {myBatches.map((room) => {
              const role = roleFor.get(room.id);
              const isTeacher = role === "teacher" || room.owner_id === profile.id;
              const instructorName = teacherMap.get(room.owner_id) ?? "Lead Instructor";
              const members = countMap.get(room.id) ?? 1;
              const assignments = assignCountMap.get(room.id) ?? 0;

              return (
                <li key={room.id}>
                  <Link href={`/classrooms/${room.id}`} className="block h-full">
                    <Card className="h-full border-border/80 transition-colors hover:border-primary/50">
                      <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-semibold text-foreground text-base hover:underline">
                              {room.name}
                            </h3>
                            {isTeacher ? (
                              <Badge variant="secondary" className="text-xs">Teacher</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs border-primary/30 text-primary">Student</Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Instructor: <span className="font-medium text-foreground">{instructorName}</span>
                          </p>
                          {room.description ? (
                            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                              {room.description}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Users className="size-3.5" />
                              {members} {members === 1 ? "student" : "students"}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="size-3.5" />
                              {assignments} {assignments === 1 ? "assignment" : "assignments"}
                            </span>
                          </div>
                          {isTeacher ? (
                            <span className="font-mono text-[11px] font-semibold bg-muted px-2 py-0.5 rounded text-foreground">
                              Code: {room.join_code}
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-primary hover:underline">
                              Enter batch →
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* 2. All Batches on CaseCode */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Users className="size-4 text-primary" />
            All Cohort Batches
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active faculty batches across universities and case clubs. Enroll with your 6-character code.
          </p>
        </div>

        {batches.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              No batches created yet. Instructors can click &ldquo;New classroom&rdquo; to launch a batch.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {batches.map((room) => {
              const isEnrolled = enrolledIds.has(room.id) || room.owner_id === profile.id;
              const instructorName = teacherMap.get(room.owner_id) ?? "Lead Instructor";
              const members = countMap.get(room.id) ?? 1;
              const assignments = assignCountMap.get(room.id) ?? 0;

              return (
                <li key={room.id}>
                  <Card className="h-full border-border/80 transition-colors hover:border-primary/50 flex flex-col justify-between">
                    <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <Link href={`/classrooms/${room.id}`} className="font-semibold text-foreground hover:underline">
                            {room.name}
                          </Link>
                          {isEnrolled ? (
                            <Badge variant="secondary" className="text-xs">Enrolled</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-border">Open Batch</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Instructor: <span className="font-medium text-foreground">{instructorName}</span>
                        </p>
                        {room.description ? (
                          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                            {room.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Users className="size-3.5" />
                            {members}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="size-3.5" />
                            {plural(assignments, "case")}
                          </span>
                        </div>
                        {isEnrolled ? (
                          <Link
                            href={`/classrooms/${room.id}`}
                            className="font-medium text-xs text-primary hover:underline"
                          >
                            Open Batch →
                          </Link>
                        ) : (
                          <JoinBatchModal batchName={room.name} />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 3. DEDICATED SUBSECTION: Public Faculty Resources & Materials */}
      <section id="public-faculty-resources" className="space-y-5 rounded-2xl border border-primary/20 bg-muted/20 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs gap-1">
                <Sparkles className="size-3" />
                Public Faculty Repository
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Free for all platform students
              </Badge>
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              Public Faculty Resources & Handouts
            </h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              Work that teachers have published openly. Anyone on the platform can read these, whether or not they are in that teacher&rsquo;s batch.
            </p>
          </div>
        </div>

        {(publicAssignments ?? []).length === 0 ? (
          <p className="pt-2 text-sm text-muted-foreground">
            Nothing shared publicly yet. A teacher can tick &ldquo;Share with everyone&rdquo;
            on an assignment to publish it here for the whole platform.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
            {(publicAssignments ?? []).map((item) => {
              const c = Array.isArray(item.cases) ? item.cases[0] : item.cases;
              const author = teacherMap.get(item.created_by ?? "") ?? "A teacher";
              return (
                <Card key={item.id} className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Shared by {author}
                  </p>
                  <h3 className="mt-1 font-medium">
                    {item.title ?? c?.title ?? "Shared work"}
                  </h3>
                  {item.instructions ? (
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                      {item.instructions}
                    </p>
                  ) : null}
                  {c?.slug ? (
                    <Link
                      href={`/cases/${c.slug}`}
                      className="mt-3 inline-block text-sm underline underline-offset-4"
                    >
                      Open the case
                    </Link>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
