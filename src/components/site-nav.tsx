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
import type { UserRow } from "@/lib/types/database";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cases", label: "Cases" },
  { href: "/paths", label: "Paths" },
  { href: "/contests", label: "Contests" },
  { href: "/progress", label: "Progress" },
  { href: "/bookmarks", label: "Bookmarks" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function SiteNav({ profile }: { profile: UserRow | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href={profile ? "/dashboard" : "/"} className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">
            C
          </div>
          <span className="text-[15px] font-semibold tracking-tight">CaseCode</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
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
                    Level {profile.level} · {profile.xp.toLocaleString()} XP
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
