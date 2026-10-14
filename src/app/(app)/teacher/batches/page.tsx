import Link from "next/link";
import type { Metadata } from "next";
import { requireTeacherActor, batchesTaughtBy } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
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
        <p className="mt-8 border-t-2 border-foreground pt-4 text-sm text-muted-foreground">
          No batches yet. Create one and share its join code with your
          students.
        </p>
      ) : (
        <div className="mt-8">
          <div className="hidden grid-cols-[1fr_7rem_8rem] gap-4 border-b border-foreground pb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground sm:grid">
            <span>Batch</span>
            <span className="text-right">Students</span>
            <span className="text-right">Join code</span>
          </div>
          <ul className="divide-y divide-border border-b border-border">
            {batches.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/teacher/batches/${b.id}`}
                  className="group grid gap-x-4 gap-y-1 py-4 sm:grid-cols-[1fr_7rem_8rem] sm:items-baseline"
                >
                  <span className="min-w-0">
                    <span className="font-display text-lg font-semibold group-hover:text-brand">{b.name}</span>
                    {b.description ? (
                      <span className="mt-0.5 block line-clamp-1 text-sm text-muted-foreground">
                        {b.description}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono text-sm tabular sm:text-right">
                    {formatNumber(counts.get(b.id) ?? 0)}
                    <span className="text-muted-foreground sm:hidden"> students</span>
                  </span>
                  <span className="font-mono text-sm sm:text-right">{b.join_code}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
