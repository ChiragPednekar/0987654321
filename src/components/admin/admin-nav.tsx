"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/licences", label: "Licences" },
  { href: "/admin/renewals", label: "Renewals" },
  { href: "/admin/usage", label: "AI usage" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/cases", label: "Case library" },
];

/** Section navigation for the platform owner. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Admin sections">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors",
                active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
