import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClassroomForms } from "@/components/classroom/classroom-forms";

export const metadata: Metadata = {
  title: "Classrooms",
  description: "Teach or study with a cohort on CaseCode.",
};

export default async function ClassroomsPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/classrooms");

  const supabase = await createClient();

  // RLS restricts classrooms to ones the viewer belongs to, so this lists
  // exactly their memberships without an explicit join.
  const [{ data: memberships }, { data: classrooms }] = await Promise.all([
    supabase
      .from("classroom_members")
      .select("classroom_id, role")
      .eq("user_id", profile.id),
    supabase
      .from("classrooms")
      .select("id, name, description, join_code, archived, owner_id")
      .order("created_at", { ascending: false }),
  ]);

  const roleFor = new Map(
    (memberships ?? []).map((m) => [m.classroom_id, m.role]),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Classrooms</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set cases for a cohort, or join one with a code.
          </p>
        </div>
        <ClassroomForms />
      </div>

      {!classrooms || classrooms.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-6 text-sm text-muted-foreground">
            You are not in a classroom yet. Create one, or join with a six
            character code from your instructor.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {classrooms.map((room) => {
            const role = roleFor.get(room.id);
            return (
              <li key={room.id}>
                <Link href={`/classrooms/${room.id}`} className="block">
                  <Card className="h-full transition-colors hover:border-primary/40">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="font-medium">{room.name}</h2>
                        {role === "teacher" ? (
                          <Badge variant="secondary">Teacher</Badge>
                        ) : null}
                      </div>
                      {room.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {room.description}
                        </p>
                      ) : null}
                      {role === "teacher" ? (
                        <p className="mt-3 font-mono text-xs text-muted-foreground">
                          Join code {room.join_code}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
