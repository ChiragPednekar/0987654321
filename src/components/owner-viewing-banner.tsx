"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye } from "lucide-react";
import type { UserRole } from "@/lib/types/database";
import { isVisitingAnotherHome, roleHome } from "@/lib/role-home";

const SURFACE_NAME: Record<string, string> = {
  "/dashboard": "the student dashboard",
  "/teacher": "the teaching dashboard",
  "/recruiter": "the recruiter dashboard",
  "/admin": "the admin dashboard",
};

/**
 * Says out loud when the owner is standing on someone else's dashboard.
 *
 * This banner is the whole reason cross-surface access could come back. The
 * first attempt at it was withdrawn because it was SILENT: the owner clicked a
 * link, landed on an empty student dashboard, and had no way to tell whether
 * the product was broken or they were simply in the wrong place. Access was
 * never the defect. Not knowing where you were standing was.
 *
 * Renders for nobody else, because nobody else can reach this state.
 */
export function OwnerViewingBanner({ role }: { role: UserRole | null }) {
  const pathname = usePathname();
  if (!isVisitingAnotherHome(pathname, role)) return null;

  const here = SURFACE_NAME[pathname] ?? "another dashboard";
  const home = roleHome(role);

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-info-border bg-info-surface px-4 py-2 text-xs sm:px-6"
    >
      <Eye className="size-3.5 shrink-0 text-info" />
      <span className="text-info">
        You are viewing <strong className="font-medium">{here}</strong> as the platform
        owner. Anything shown here is your own account&apos;s, not a student&apos;s.
      </span>
      <Link
        href={home}
        className="underline underline-offset-2 hover:text-foreground"
      >
        Back to {SURFACE_NAME[home] ?? "your dashboard"}
      </Link>
    </div>
  );
}
