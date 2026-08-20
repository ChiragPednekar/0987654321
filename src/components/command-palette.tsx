"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  BookOpen,
  FileText,
  LayoutDashboard,
  Route,
  Search,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import { DOMAIN_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Domain } from "@/lib/types/database";
import type { SearchResponse } from "@/app/api/search/route";

const PAGES = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Case Library", href: "/cases", icon: BookOpen },
  { title: "Skill Tracks", href: "/paths", icon: Route },
  { title: "Contests", href: "/contests", icon: Trophy },
  { title: "Leaderboard", href: "/leaderboard", icon: Users },
  { title: "Progress", href: "/progress", icon: FileText },
  { title: "Bookmarks", href: "/bookmarks", icon: BookOpen },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "How grading works", href: "/how-grading-works", icon: FileText },
];

const EMPTY: SearchResponse = { cases: [], tracks: [] };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResponse>(EMPTY);
  const [loading, setLoading] = React.useState(false);

  // ⌘K / Ctrl+K anywhere, and Escape to leave.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced remote search. Local pages filter instantly via cmdk itself.
  React.useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        );
        if (response.ok) setResults(await response.json());
      } catch {
        // Aborted or offline — leave the last results in place.
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <Command
        // cmdk filters the static pages; server results must not be re-filtered
        // or a match on scenario text would be thrown away client-side.
        shouldFilter={false}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
        loop
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search cases, tracks and pages…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
            esc
          </kbd>
        </div>

        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
            {loading ? "Searching…" : "No results."}
          </Command.Empty>

          {results.cases.length > 0 && (
            <Group heading="Cases">
              {results.cases.map((item) => (
                <Item key={item.id} value={item.href} onSelect={() => go(item.href)}>
                  <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{item.title}</span>
                  {item.difficulty && (
                    <span className="shrink-0 text-xs capitalize text-muted-foreground">
                      {item.difficulty}
                    </span>
                  )}
                  {item.domain && <DomainBadge domain={item.domain} />}
                </Item>
              ))}
            </Group>
          )}

          {results.tracks.length > 0 && (
            <Group heading="Skill Tracks">
              {results.tracks.map((item) => (
                <Item key={item.id} value={item.href} onSelect={() => go(item.href)}>
                  <Route className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{item.title}</span>
                  {item.domain && <DomainBadge domain={item.domain} />}
                </Item>
              ))}
            </Group>
          )}

          <Group heading="Go to">
            {PAGES.filter((page) =>
              page.title.toLowerCase().includes(query.trim().toLowerCase()),
            ).map((page) => (
              <Item key={page.href} value={page.href} onSelect={() => go(page.href)}>
                <page.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{page.title}</span>
              </Item>
            ))}
          </Group>
        </Command.List>

        <div className="flex items-center gap-4 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </Command>
    </div>
  );
}

function Group({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <Command.Group
      heading={heading}
      className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  value,
  children,
  onSelect,
}: {
  /** Unique and stable — hrefs are both. cmdk keys selection off this. */
  value: string;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm",
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
      )}
    >
      {children}
    </Command.Item>
  );
}

function DomainBadge({ domain }: { domain: string }) {
  return (
    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {DOMAIN_LABEL[domain as Domain] ?? domain}
    </span>
  );
}
