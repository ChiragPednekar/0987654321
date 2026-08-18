"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIFFICULTIES, DOMAINS } from "@/lib/constants";

const ANY = "__any";

export function CaseFilters({
  companyTracks,
  signedIn,
}: {
  companyTracks: string[];
  signedIn: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");

  const update = React.useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === ANY) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  // Debounce the text search so we don't navigate on every keystroke.
  React.useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (search === current) return;

    const timer = setTimeout(() => update("q", search || null), 350);
    return () => clearTimeout(timer);
  }, [search, searchParams, update]);

  const hasFilters = ["domain", "difficulty", "track", "status", "q"].some((k) =>
    searchParams.has(k),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search cases…"
          className="pl-9"
          aria-label="Search cases"
        />
      </div>

      <Select
        value={searchParams.get("domain") ?? ANY}
        onValueChange={(value) => update("domain", value)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Domain" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All domains</SelectItem>
          {DOMAINS.map((domain) => (
            <SelectItem key={domain.value} value={domain.value}>
              {domain.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("difficulty") ?? ANY}
        onValueChange={(value) => update("difficulty", value)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Difficulty" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any difficulty</SelectItem>
          {DIFFICULTIES.map((difficulty) => (
            <SelectItem key={difficulty.value} value={difficulty.value}>
              {difficulty.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {companyTracks.length > 0 && (
        <Select
          value={searchParams.get("track") ?? ANY}
          onValueChange={(value) => update("track", value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All companies</SelectItem>
            {companyTracks.map((track) => (
              <SelectItem key={track} value={track}>
                {track}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {signedIn && (
        <Select
          value={searchParams.get("status") ?? ANY}
          onValueChange={(value) => update("status", value)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All</SelectItem>
            <SelectItem value="solved">Solved</SelectItem>
            <SelectItem value="attempted">Attempted</SelectItem>
            <SelectItem value="todo">Todo</SelectItem>
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X /> Clear
        </Button>
      )}
    </div>
  );
}
