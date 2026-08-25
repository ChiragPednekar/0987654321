"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  BarChart3,
  BookMarked,
  Building2,
  ChevronLeft,
  GraduationCap,
  LayoutDashboard,
  Library,
  MessagesSquare,
  Route,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/database";

/**
 * Collapsible primary navigation (spec §1).
 *
 * Collapsed state lives in localStorage rather than a cookie: it is a personal
 * display preference with no bearing on what the server renders, and a cookie
 * would be sent on every request for nothing.
 */

const STORAGE_KEY = "casecode:sidebar-collapsed";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Restrict to a role; omitted means everyone signed in. */
  role?: UserRole;
};

const GROUPS: { heading: string; items: Item[] }[] = [
  {
    heading: "Practise",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/cases", label: "Cases", icon: Library },
      { href: "/paths", label: "Paths", icon: Route },
      { href: "/contests", label: "Contests", icon: Trophy },
    ],
  },
  {
    heading: "You",
    items: [
      { href: "/progress", label: "Progress", icon: BarChart3 },
      { href: "/bookmarks", label: "Bookmarks", icon: BookMarked },
    ],
  },
  {
    heading: "Community",
    items: [
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
      { href: "/groups", label: "Groups", icon: MessagesSquare },
      { href: "/classrooms", label: "Classrooms", icon: GraduationCap },
    ],
  },
  {
    heading: "Staff",
    items: [
      { href: "/institution", label: "Placement", icon: GraduationCap },
      { href: "/recruiter", label: "Recruiter", icon: Building2, role: "recruiter" },
      { href: "/admin", label: "Admin", icon: Users, role: "admin" },
    ],
  },
];

export function AppSidebar({
  role,
  isInstitutionStaff = false,
}: {
  role: UserRole | null;
  /** Placement-cell staff on a campus licence. */
  isInstitutionStaff?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  // Rendered expanded on the server; the stored preference is applied after
  // mount so the markup matches and hydration does not warn.
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    setReady(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.href === "/institution") return isInstitutionStaff;
      return !item.role || item.role === role;
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 border-r border-border md:flex md:flex-col",
        // Width is the only thing that animates; animating layout of the whole
        // page would make every route transition feel rubbery.
        ready && "transition-[width] duration-200",
        collapsed ? "w-[4.25rem]" : "w-56",
      )}
    >
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {groups.map((group) => (
          <div key={group.heading} className="mb-4">
            <p
              className={cn(
                "px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
                collapsed && "sr-only",
              )}
            >
              {group.heading}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      // The label is the accessible name when expanded, so the
                      // title only has to stand in when it is hidden.
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className={cn(collapsed && "sr-only")}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex items-center gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      >
        <ChevronLeft
          className={cn(
            "size-4 shrink-0 transition-transform duration-200",
            collapsed && "rotate-180",
          )}
        />
        <span className={cn(collapsed && "sr-only")}>Collapse</span>
      </button>
    </aside>
  );
}
