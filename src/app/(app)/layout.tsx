import { getCurrentUser } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav profile={profile} />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-7xl px-4 text-xs text-muted-foreground sm:px-6">
          CaseCode — practise business cases, get graded, improve.
        </div>
      </footer>
    </div>
  );
}
