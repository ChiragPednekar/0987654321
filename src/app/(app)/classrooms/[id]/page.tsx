import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssignCaseForm } from "@/components/classroom/assign-case-form";
import { DIFFICULTY_CLASS, DOMAIN_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Difficulty, Domain } from "@/lib/types/database";

export const metadata: Metadata = { title: "Classroom" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClassroomPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await getCurrentUser();
  if (!profile) redirect(`/login?next=/classrooms/${id}`);

  const supabase = await createClient();

  const { data: room } = await supabase
    .from("classrooms")
    .select("id, name, description, join_code, owner_id")
    .eq("id", id)
    .maybeSingle();

  // Non-members are filtered out by RLS, so this is a 404 rather than a 403 —
  // the existence of a classroom is itself private.
  if (!room) notFound();

  const [{ data: membership }, { data: roster }, { data: assignments }] =
    await Promise.all([
      supabase
        .from("classroom_members")
        .select("role")
        .eq("classroom_id", id)
        .eq("user_id", profile.id)
        .maybeSingle(),
      supabase
        .from("classroom_members")
        .select("user_id, role, joined_at, users(full_name, cases_solved, ce)")
        .eq("classroom_id", id),
      supabase
        .from("classroom_assignments")
        .select("id, due_at, note, cases(slug, title, domain, difficulty)")
        .eq("classroom_id", id)
        .order("due_at", { ascending: true }),
    ]);

  const isTeacher = membership?.role === "teacher";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/classrooms"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All classrooms
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{room.name}</h1>
          {room.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{room.description}</p>
          ) : null}
          {isTeacher ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              Join code {room.join_code}
            </p>
          ) : null}
        </div>
        {isTeacher ? <AssignCaseForm classroomId={room.id} /> : null}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Assigned cases</CardTitle>
        </CardHeader>
        <CardContent>
          {!assignments || assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing assigned yet.</p>
          ) : (
            <ul className="space-y-3">
              {assignments.map((row) => {
                const c = Array.isArray(row.cases) ? row.cases[0] : row.cases;
                if (!c) return null;
                return (
                  <li key={row.id} className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/cases/${c.slug}`}
                      className="font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    <Badge variant="outline">{DOMAIN_LABEL[c.domain as Domain]}</Badge>
                    <span
                      className={cn("text-xs", DIFFICULTY_CLASS[c.difficulty as Difficulty])}
                    >
                      {c.difficulty}
                    </span>
                    {row.due_at ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="size-3.5" />
                        due {new Date(row.due_at).toLocaleDateString()}
                      </span>
                    ) : null}
                    {row.note ? (
                      <span className="text-xs text-muted-foreground">{row.note}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Roster{" "}
            <span className="text-sm font-normal text-muted-foreground tabular">
              ({roster?.length ?? 0})
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
                  <th className="py-2 text-right font-medium">Solved</th>
                  <th className="py-2 text-right font-medium">CE</th>
                </tr>
              </thead>
              <tbody>
                {(roster ?? []).map((row) => {
                  const u = Array.isArray(row.users) ? row.users[0] : row.users;
                  return (
                    <tr key={row.user_id} className="border-b border-border last:border-0">
                      <td className="py-2">{u?.full_name ?? "Anonymous"}</td>
                      <td className="py-2 text-muted-foreground">{row.role}</td>
                      <td className="py-2 text-right tabular">{u?.cases_solved ?? 0}</td>
                      <td className="py-2 text-right tabular">{u?.ce ?? 0}</td>
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
