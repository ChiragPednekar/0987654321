import Link from "next/link";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireTeacherActor, batchesTaughtBy } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateBatchForm } from "@/components/teacher/create-batch-form";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Batches" };

export default async function BatchesPage() {
  const actor = await requireTeacherActor();
  const admin = createAdminClient();
  const ids = await batchesTaughtBy(actor.id);

  const [{ data: batches }, { data: members }] = await Promise.all([
    ids.length
      ? admin.from("classrooms").select("*").in("id", ids).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    ids.length
      ? admin.from("classroom_members").select("classroom_id").in("classroom_id", ids).eq("role", "student")
      : Promise.resolve({ data: [] }),
  ]);

  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    counts.set(m.classroom_id, (counts.get(m.classroom_id) ?? 0) + 1);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Batches</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Students join with the code — no invites needed.
          </p>
        </div>
        <CreateBatchForm />
      </div>

      {!batches || batches.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No batches yet. Create one and share its join code with your
            students.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {batches.map((b) => (
            <li key={b.id}>
              <Link href={`/teacher/batches/${b.id}`} className="block">
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-medium">{b.name}</h2>
                      <Badge variant="outline" className="shrink-0 font-mono">
                        {b.join_code}
                      </Badge>
                    </div>
                    {b.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {b.description}
                      </p>
                    ) : null}
                    <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground tabular">
                      <Users className="size-3.5" />
                      {formatNumber(counts.get(b.id) ?? 0)} students
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
