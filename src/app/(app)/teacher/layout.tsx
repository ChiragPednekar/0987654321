import { redirect } from "next/navigation";
import { AuthzError, requireTeacherActor } from "@/lib/authz";
import { Page } from "@/components/page-header";

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
    // No tab bar: it repeated the sidebar link for link, and on a phone the
    // header menu carries the same four.
    <Page>{children}</Page>
  );
}
