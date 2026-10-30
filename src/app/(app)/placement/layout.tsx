import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireActor } from "@/lib/authz";
import { placementInstitutions } from "@/lib/placement/server";
import { Page, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default async function PlacementLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const institutions = await placementInstitutions(actor);

  if (!institutions.length) {
    return (
      <Page narrow>
        <PageHeader eyebrow="College" title="Placement Cell" />
        <EmptyState
          className="mt-8"
          icon={Building2}
          title="You're not on a placement cell yet"
          description="Ask your college's licence owner to add you as staff through the institution membership controls."
        />
      </Page>
    );
  }

  // Each page carries its own header; the layout only adds the college
  // switcher, and only for staff who work across more than one college.
  return (
    <Page className="space-y-7">
      {institutions.length > 1 && (
        <nav aria-label="College" className="flex flex-wrap gap-2 text-[13px]">
          {institutions.map((i) => (
            <Link
              key={i.id}
              className="rounded-full border border-border bg-card px-3 py-1.5 font-medium hover:border-brand-border hover:text-brand"
              href={`/placement?institution=${i.id}`}
            >
              {i.name}
            </Link>
          ))}
        </nav>
      )}
      {children}
    </Page>
  );
}
