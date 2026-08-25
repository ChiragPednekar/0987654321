import { redirect } from "next/navigation";
import { AuthzError, requireTeacherActor } from "@/lib/authz";
import { TeacherNav } from "@/components/teacher/teacher-nav";

/**
 * Guards the whole teacher area.
 *
 * Every page under /teacher is behind this, so a new page cannot be added
 * without the check. Individual routes still verify batch ownership — this only
 * establishes that the visitor is a teacher at all.
 */
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireTeacherActor();
  } catch (error) {
    if (error instanceof AuthzError && error.status === 401) {
      redirect("/login?next=/teacher");
    }
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <TeacherNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
