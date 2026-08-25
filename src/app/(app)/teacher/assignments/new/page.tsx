import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { requireTeacherActor, batchesTaughtBy } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { AssignmentForm } from "@/components/teacher/assignment-form";
import { EmptyState } from "@/components/teacher/empty-state";

export const metadata: Metadata = { title: "New assignment" };

export default async function NewAssignmentPage() {
  const actor = await requireTeacherActor();
  const admin = createAdminClient();
  const ids = await batchesTaughtBy(actor.id);

  if (ids.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No batches yet"
        body="An assignment belongs to a batch. Create one first."
        action={{ href: "/teacher/batches", label: "Create a batch" }}
      />
    );
  }

  const [{ data: batches }, { data: own }] = await Promise.all([
    admin.from("classrooms").select("id, name").in("id", ids),
    admin
      .from("cases")
      .select("id, title")
      .eq("created_by", actor.id)
      .eq("is_published", true)
      .limit(50),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href="/teacher/assignments" className="text-sm text-muted-foreground hover:text-foreground">
        ← Assignments
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">New assignment</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Students solve it the normal way — their submission attaches here by
        itself.
      </p>
      <div className="mt-6">
        <AssignmentForm batches={batches ?? []} ownQuestions={own ?? []} />
      </div>
    </div>
  );
}
