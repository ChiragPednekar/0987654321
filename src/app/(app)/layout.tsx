import Link from "next/link";
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
