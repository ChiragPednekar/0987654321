"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ROLES = ["", "student", "teacher", "admin", "recruiter"] as const;

/** Search and role filter, kept in the URL so a filtered view is shareable. */
export function UserFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const role = params.get("role") ?? "";

  // Debounced: typing should not fire a query per keystroke.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      next.delete("page");
      router.replace(`/admin/users?${next.toString()}`);
    }, 300);
    return () => clearTimeout(timer);
    // `params` is intentionally omitted: including it re-runs this on every
    // navigation the effect itself causes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, router]);

  function setRole(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("role", value);
    else next.delete("role");
    next.delete("page");
    router.replace(`/admin/users?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name or email…"
        aria-label="Search users"
        className="max-w-xs"
      />
      <div className="flex flex-wrap gap-1">
        {ROLES.map((r) => (
          <button
            key={r || "all"}
            type="button"
            onClick={() => setRole(r)}
            aria-pressed={role === r}
            className={cn(
              "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
              role === r
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {r || "all"}
          </button>
        ))}
      </div>
    </div>
  );
}
