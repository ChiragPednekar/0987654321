import Link from "next/link";
import { requireActor } from "@/lib/authz";
import { placementInstitutions } from "@/lib/placement/server";

export default async function PlacementLayout({children}:{children:React.ReactNode}) {
  const actor=await requireActor();const institutions=await placementInstitutions(actor);
  if(!institutions.length) return <div className="mx-auto max-w-2xl p-8"><h1 className="text-2xl font-semibold">Placement Cell</h1><p className="mt-3 text-muted-foreground">Your account has no placement-cell membership yet. Ask the college licence owner to add you as staff through the institution membership controls.</p></div>;
  return <div className="mx-auto max-w-7xl space-y-7 p-4 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5"><div><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">College workspace</p><Link href="/placement" className="font-editorial text-4xl">Placement Cell</Link></div><nav className="flex flex-wrap gap-3 text-sm">{institutions.map(i=><Link key={i.id} className="rounded-lg border px-3 py-2 hover:bg-muted" href={`/placement?institution=${i.id}`}>{i.name}</Link>)}</nav></div>{children}</div>;
}
