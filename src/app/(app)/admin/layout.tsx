import { redirect } from "next/navigation";
import { AuthzError, requireAdminActor } from "@/lib/authz";
import { AdminNav } from "@/components/admin/admin-nav";

/**
 * Guards the whole admin area.
 *
 * The single platform owner only. Middleware also checks /admin, but that is a
 * convenience for redirects — this is the check that actually holds, because a
 * page cannot render without it.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdminActor();
  } catch (error) {
    if (error instanceof AuthzError && error.status === 401) {
      redirect("/login?next=/admin");
    }
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <AdminNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
