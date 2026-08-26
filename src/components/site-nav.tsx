"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Flame, LogOut, Menu, Settings, Shield, User as UserIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import type { NotificationRow, UserRole, UserRow } from "@/lib/types/database";
import { roleHome } from "@/lib/role-home";

/**
 * Top-bar links, per role.
 *
 * The third and last place that assumed everyone was a student — the sidebar
 * and the command palette were the other two. A shared "Dashboard" link here
 * meant the platform owner's own header pointed at the student product, and the
 * logo did the same.
 *
 * Signed-out visitors get the marketing set: the public library is the top of
 * the funnel and stays reachable without an account.
 */
const PUBLIC_LINKS = [
  { href: "/cases", label: "Cases" },
  { href: "/paths", label: "Paths" },
  { href: "/contests", label: "Contests" },
  { href: "/leaderboard", label: "Leaderboard" },
];

const STUDENT_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cases", label: "Cases" },
  { href: "/paths", label: "Paths" },
  { href: "/contests", label: "Contests" },
  { href: "/progress", label: "Progress" },
  { href: "/bookmarks", label: "Bookmarks" },
  { href: "/leaderboard", label: "Leaderboard" },
];

const TEACHER_LINKS = [
  { href: "/teacher", label: "Dashboard" },
  { href: "/teacher/batches", label: "Batches" },
  { href: "/teacher/assignments", label: "Assignments" },
  { href: "/teacher/questions", label: "Questions" },
  { href: "/cases", label: "Cases" },
];

const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/licences", label: "Licences" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/cases", label: "Case library" },
  { href: "/admin/usage", label: "AI usage" },
];

function linksFor(role: UserRole | null | undefined) {
  switch (role) {
    case "admin":
      return ADMIN_LINKS;
    case "teacher":
      return TEACHER_LINKS;
    default:
      return STUDENT_LINKS;
  }
}

export function SiteNav({
  profile,
  notifications = [],
  unreadCount = 0,
}: {
  profile: UserRow | null;
  notifications?: NotificationRow[];
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const LINKS = profile ? linksFor(profile.role) : PUBLIC_LINKS;
  // The wordmark goes to your own dashboard, not always the student one.
  const homeHref = profile ? roleHome(profile.role) : "/";

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href={homeHref} className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">
            C
          </div>
          <span className="text-[15px] font-semibold tracking-tight">CaseCode</span>
        </Link>

        {/* Signed-in users navigate from the sidebar; showing the same links
            twice on desktop is just noise. The mobile sheet below still
            carries them, because there is no sidebar at that width. */}
        <nav
          className={
            profile
              ? "hidden"
              : "hidden items-center gap-1 md:flex"
          }
        >
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {profile && profile.current_streak > 0 && (
            <div
              className="hidden items-center gap-1.5 rounded-md bg-[color-mix(in_oklch,var(--warning)_12%,transparent)] px-2.5 py-1 text-xs font-medium text-[var(--warning)] sm:flex"
              title={`${profile.current_streak} day streak`}
            >
              <Flame className="size-3.5" />
              <span className="tabular">{profile.current_streak}</span>
            </div>
          )}

          {profile && (
            <NotificationBell
              initial={notifications}
              unreadCount={unreadCount}
            />
          )}

          <ThemeToggle />

          {profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full transition-opacity hover:opacity-80"
                  aria-label="Account menu"
                >
                  <Avatar className="size-8">
                    {profile.avatar_url && (
                      <AvatarImage src={profile.avatar_url} alt="" />
                    )}
                    <AvatarFallback>{initials(profile.full_name)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="truncate text-sm font-medium">
                    {profile.full_name ?? "Student"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {profile.email}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground tabular">
                    Level {profile.level} · {profile.ce.toLocaleString()} CE
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <UserIcon /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings /> Settings
                  </Link>
                </DropdownMenuItem>
                {profile.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield /> Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-border bg-background px-4 py-2 md:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block rounded-md px-3 py-2 text-sm",
                pathname.startsWith(link.href)
                  ? "bg-accent font-medium"
                  : "text-muted-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
