"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  BarChart3,
  BookMarked,
  Briefcase,
  Building2,
  ChevronLeft,
  ClipboardCheck,
  Database,
  FileText,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  Library,
  LineChart,
  MessageSquare,
  MessagesSquare,
  Newspaper,
  Presentation,
  Route,
  Sheet,
  Trophy,
  Users,
  Calculator,
  Gauge,
  ListOrdered,
  SquarePlus,
  Award,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/database";
import { useIsClient, useStored, writeStored } from "@/hooks/use-browser-state";

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

/**
 * Navigation, per role.
 *
 * The three dashboards are separate entities, so the sidebar shows one of them
 * — not all three with the irrelevant parts filtered out. Previously every role
 * got the student menu with a "Dashboard" link hard-wired to /dashboard, so the
 * most obvious link in an admin's own nav dropped them into the student
 * experience.
 *
 * Teacher keeps Classrooms and Groups: the teacher and student sides are one
 * product sharing data — a batch created here is the batch a student joins.
 * Admin keeps neither; the platform owner administers the platform.
 */
const STUDENT_GROUPS: { heading: string; items: Item[] }[] = [
  {
    heading: "Practise",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/cases", label: "Cases", icon: Library },
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/daily", label: "Daily quiz", icon: Newspaper },
      { href: "/practice", label: "Aptitude", icon: Calculator },
      { href: "/sql", label: "SQL", icon: Database },
      { href: "/excel", label: "Excel", icon: Sheet },
      { href: "/interview", label: "HR interview", icon: MessageSquare },
      { href: "/resume", label: "Resume", icon: FileText },
      { href: "/presentation", label: "Deck review", icon: Presentation },
      { href: "/simulation", label: "Simulation", icon: LineChart },
      { href: "/negotiation", label: "Negotiation", icon: Handshake },
      { href: "/sales", label: "Sales role-play", icon: Briefcase },
      { href: "/paths", label: "Paths", icon: Route },
    ],
  },
  {
    heading: "You",
    items: [
      { href: "/progress", label: "Progress", icon: BarChart3 },
      { href: "/bookmarks", label: "Bookmarks", icon: BookMarked },
      { href: "/certificates", label: "Certificates", icon: Award },
      { href: "/experts", label: "Expert mocks", icon: UserRoundCheck },
      { href: "/upgrade", label: "Upgrade", icon: Sparkles },
    ],
  },
  {
    heading: "Community",
    items: [
      { href: "/leaderboard", label: "Leaderboard", icon: ListOrdered },
      { href: "/competitions", label: "Competitions", icon: Trophy },
      { href: "/gd", label: "Group discussions", icon: Users },
      { href: "/groups", label: "Groups", icon: MessagesSquare },
      { href: "/classrooms", label: "Classrooms", icon: GraduationCap },
    ],
  },
];

const TEACHER_GROUPS: { heading: string; items: Item[] }[] = [
  {
    heading: "Teaching",
    items: [
      { href: "/teacher", label: "Dashboard", icon: LayoutDashboard },
      { href: "/teacher/batches", label: "Batches", icon: GraduationCap },
      { href: "/teacher/assignments", label: "Assignments", icon: ClipboardCheck },
      { href: "/teacher/questions", label: "Question bank", icon: Library },
    ],
  },
  {
    heading: "Library",
    items: [
      { href: "/cases", label: "Cases", icon: Library },
      { href: "/practice", label: "Aptitude", icon: Calculator },
      { href: "/sql", label: "SQL", icon: Database },
      { href: "/excel", label: "Excel", icon: Sheet },
      { href: "/paths", label: "Paths", icon: Route },
      // Any teacher can add their own case or aptitude question, then assign
      // it from the library like everything else.
      { href: "/teacher/questions/new", label: "Add question", icon: SquarePlus },
    ],
  },
  {
    heading: "Community",
    items: [
      { href: "/classrooms", label: "Classrooms", icon: MessagesSquare },
      { href: "/institution", label: "Placement", icon: Building2 },
    ],
  },
];

const ADMIN_GROUPS: { heading: string; items: Item[] }[] = [
  {
    heading: "Platform",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/cases", label: "Case library", icon: Library },
      { href: "/admin/current-affairs", label: "Daily quiz", icon: Newspaper },
      { href: "/admin/company-reports", label: "Reported questions", icon: MessagesSquare },
    ],
  },
  {
    heading: "Commercial",
    items: [
      { href: "/admin/licences", label: "Licences", icon: Building2 },
      { href: "/admin/renewals", label: "Renewals", icon: BarChart3 },
      { href: "/admin/usage", label: "AI usage", icon: Gauge },
      { href: "/admin/experts", label: "Experts & sales", icon: UserRoundCheck },
    ],
  },
  {
    /*
      The owner can now open the other two products, so the navigation has to
      offer the trip — otherwise the access exists only for someone who knows
      to type the URL.

      Grouped and labelled separately rather than mixed into the platform
      links, because leaving here is a different kind of action from opening
      another admin page, and a banner appears once you arrive.
    */
    heading: "View as",
    items: [
      { href: "/dashboard", label: "Student product", icon: GraduationCap },
      { href: "/teacher", label: "Teaching product", icon: ClipboardCheck },
    ],
  },
];

const RECRUITER_GROUPS: { heading: string; items: Item[] }[] = [
  {
    heading: "Hiring",
    items: [
      { href: "/recruiter", label: "Dashboard", icon: LayoutDashboard },
      { href: "/cases", label: "Cases", icon: Library },
    ],
  },
];

/**
 * The menu for an account with neither a plan nor a licence: the way to pay,
 * and the two products sold on their own. The middleware sends every other
 * page to /upgrade (072), so listing them would only be links that bounce.
 */
const UNPAID_GROUPS: { heading: string; items: Item[] }[] = [
  {
    heading: "Get started",
    items: [
      { href: "/upgrade", label: "Upgrade", icon: Sparkles },
      { href: "/pricing", label: "Plans & pricing", icon: ListOrdered },
    ],
  },
  {
    heading: "No plan needed",
    items: [
      { href: "/certificates", label: "Certificates", icon: Award },
      { href: "/experts", label: "Expert mocks", icon: UserRoundCheck },
    ],
  },
];

export function AppSidebar({
  role,
  isInstitutionStaff = false,
  entitled = true,
}: {
  role: UserRole | null;
  /** Placement-cell staff on a campus licence. */
  isInstitutionStaff?: boolean;
  /** Has a plan or a licence. Without one, only the way to pay is listed. */
  entitled?: boolean;
}) {
  const pathname = usePathname();
  // Rendered expanded on the server; the stored preference takes over on
  // hydration, so the markup matches and hydration does not warn.
  const collapsed = useStored(STORAGE_KEY) === "1";
  const ready = useIsClient();

  function toggle() {
    writeStored(STORAGE_KEY, collapsed ? "0" : "1");
  }

  /**
   * One role, one menu — and no link out of it.
   *
   * Every item below belongs to the signed-in role's own dashboard or to a
   * genuinely shared feature (the case library, classrooms). Nothing points at
   * another role's home, because the middleware would bounce it straight back:
   * a link that cannot be followed is worse than no link.
   *
   * `isTeacher` used to add a "Teaching" entry to the student menu for someone
   * who ran a batch without the platform teacher role. Creating a classroom now
   * requires that role, so the case cannot arise for anyone new — and for
   * anyone left over the link would only bounce. Promote the account to
   * `teacher` instead; that is what the role is for.
   */
  const groups = (
    !entitled
      ? UNPAID_GROUPS
      : role === "admin"
      ? ADMIN_GROUPS
      : role === "recruiter"
        ? RECRUITER_GROUPS
        : role === "teacher"
          ? TEACHER_GROUPS
          : STUDENT_GROUPS
  )
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.href === "/institution") return isInstitutionStaff;
        return !item.role || item.role === role;
      }),
    }))
    .filter((group) => group.items.length > 0);

  // Only the most specific match is highlighted. A plain prefix test lit up
  // "Dashboard" (/teacher) on every teacher page, and "Question bank" next to
  // "Add question" (/teacher/questions/new).
  const activeHref = groups
    .flatMap((group) => group.items.map((item) => item.href))
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

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
                "px-3 pb-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-subtle-foreground",
                collapsed && "sr-only",
              )}
            >
              {group.heading}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.href === activeHref;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      // The label is the accessible name when expanded, so the
                      // title only has to stand in when it is hidden.
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        // Active is ink and a rule at the edge, like a tab in a
                        // ring binder — not a tinted pill.
                        "relative flex items-center gap-3 rounded-sm px-3 py-[7px] text-sm transition-colors",
                        active
                          ? "bg-card font-medium text-foreground shadow-[inset_2px_0_0_var(--brand)]"
                          : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
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
