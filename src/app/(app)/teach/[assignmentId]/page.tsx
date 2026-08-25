import { redirect } from "next/navigation";

/** Superseded by /teacher/assignments/[id]; kept so old links resolve. */
export default async function TeachAssignmentRedirect({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  redirect(`/teacher/assignments/${assignmentId}`);
}
