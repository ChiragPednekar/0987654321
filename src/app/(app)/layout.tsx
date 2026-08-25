import Link from "next/link";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { NotificationRow } from "@/lib/types/database";
import { SiteNav } from "@/components/site-nav";
import { CommandPalette } from "@/components/command-palette";
import { AppSidebar } from "@/components/app-sidebar";
import { createAdminClientOrNull } from "@/lib/supabase/admin";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUser();

  // Notifications ride along with the layout so the bell is populated on first
  // paint rather than flashing empty and then filling in.
  let notifications: NotificationRow[] = [];
  let unreadCount = 0;
  // Drives the Placement link. Optional enrichment, so a missing service-role
  // key hides the link rather than taking the whole shell down.
  let isInstitutionStaff = false;
  let isTeacher = false;

  if (profile) {
    const supabase = await createClient();
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .is("read_at", null),
    ]);

    notifications = (data ?? []) as NotificationRow[];
    unreadCount = count ?? 0;

    const admin = createAdminClientOrNull();
    if (admin) {
      const { count: staffRows } = await admin
        .from("institution_members")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .in("role", ["owner", "staff"]);
      isInstitutionStaff = (staffRows ?? 0) > 0;

      const { count: taught } = await admin
        .from("classroom_members")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("role", "teacher");
      isTeacher = (taught ?? 0) > 0;
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav
        profile={profile}
        notifications={notifications}
        unreadCount={unreadCount}
      />
      <CommandPalette />
      {profile ? (
        <div className="flex flex-1">
          <AppSidebar
            role={profile.role}
            isInstitutionStaff={isInstitutionStaff}
            isTeacher={isTeacher}
          />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      ) : (
        <main className="flex-1">{children}</main>
      )}
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 text-xs text-muted-foreground sm:px-6">
          <span>CaseCode — practise business cases, get graded, improve.</span>
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/how-grading-works" className="hover:text-foreground">
              How grading works
            </Link>
            <Link href="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
